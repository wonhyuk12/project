-- Phase 1+2 of porting chisung42/choreohub's creative-record features:
-- 1) 프로젝트 라이선스(사용 허가 범위), 2) 버전이 실제로 담당한 구간(초 단위) 기록,
-- 3) 수정 제안 -> 소유자 승인/거절 워크플로우.

-- ---------------------------------------------------------------------------
-- 1) 라이선스
-- ---------------------------------------------------------------------------
alter table public.projects
  add column if not exists license text not null default '연습 전용'
    check (license in ('연습 전용', '비상업 커버 허용', '리믹스 허용', '사전승인 필요'));

-- ---------------------------------------------------------------------------
-- 2) 버전이 담당한 구간 — null이면 "전체"(보통 원작 v1), 값이 있으면 그 구간만 새로 만들었다는 뜻.
--    프로젝트 페이지에서 "이 구간은 누가 마지막으로 고쳤는지" 크레딧 타임라인을 그리는 데 쓴다.
-- ---------------------------------------------------------------------------
alter table public.versions
  add column if not exists covers_start_sec numeric,
  add column if not exists covers_end_sec numeric;

-- ---------------------------------------------------------------------------
-- 3) 수정 제안(proposals) — '수정 제안' 이상 권한이면 특정 구간에 새 영상을 제안으로 올리고,
--    소유자가 승인(merge_proposal 함수로 versions에 새 행 생성)하거나 거절한다.
-- ---------------------------------------------------------------------------
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  note text not null default '',
  start_sec numeric not null,
  end_sec numeric not null,
  video_path text not null,
  duration_sec numeric not null default 0,
  pose_data jsonb not null default '[]'::jsonb,
  status text not null default 'proposed' check (status in ('proposed', 'merged', 'declined')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists proposals_project_id_idx on public.proposals(project_id);

alter table public.proposals enable row level security;

-- 소유자 항상 가능, 멤버는 permission이 '수정 제안' 또는 '직접 수정'일 때만 제안 가능
-- (can_edit_project는 '직접 수정'만 허용하므로 제안엔 못 쓴다 — 별도 헬퍼가 필요).
create or replace function public.can_propose_project(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_project_owner(p_project_id, p_user_id)
    or exists (
      select 1 from public.project_members
      where project_id = p_project_id and user_id = p_user_id
        and permission in ('수정 제안', '직접 수정')
    );
$$;

create policy "proposals_select_project" on public.proposals
  for select using (public.has_project_access(project_id, auth.uid()));

create policy "proposals_insert_author" on public.proposals
  for insert with check (
    author_id = auth.uid() and public.can_propose_project(project_id, auth.uid())
  );

-- 상태 변경(승인/거절)은 소유자만 — merge는 아래 merge_proposal() RPC를 통해서만 하고,
-- 이 update 정책은 "거절"처럼 versions에 새 행을 만들 필요 없는 단순 상태 변경에 쓴다.
create policy "proposals_update_owner_decide" on public.proposals
  for update using (
    public.is_project_owner(project_id, auth.uid())
  ) with check (
    public.is_project_owner(project_id, auth.uid())
  );

-- 제안자 본인은 자기 제안을 철회할 수 있고, 소유자는 아무 제안이나 지울 수 있다.
create policy "proposals_delete_author_or_owner" on public.proposals
  for delete using (
    author_id = auth.uid() or public.is_project_owner(project_id, auth.uid())
  );

-- 제안 영상도 기존 videos 버킷 select 정책에 포함시켜서 다른 프로젝트 멤버가 재생할 수 있게 한다.
drop policy if exists "videos_select_own_or_shared" on storage.objects;
create policy "videos_select_own_or_shared" on storage.objects
  for select using (
    bucket_id = 'videos' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.versions v
        where v.video_path = name and public.is_project_member(v.project_id, auth.uid())
      )
      or exists (
        select 1 from public.compare_runs cr
        where (cr.ref_video ->> 'video_path') = name
          and public.is_project_member(cr.project_id, auth.uid())
      )
      or exists (
        select 1 from public.proposals p
        where p.video_path = name and public.has_project_access(p.project_id, auth.uid())
      )
    )
  );

-- 승인("반영") — 소유자만 실행 가능. versions insert 정책은 auth.uid() = user_id를 요구해서
-- 소유자가 직접 insert하면 제안자 크레딧을 붙일 수 없다 — SECURITY DEFINER로 감싸서 versions엔
-- 원래 제안자(author_id)를 user_id로 넣고, proposals는 승인 상태로 바꾸는 걸 한 트랜잭션으로 묶는다.
create or replace function public.merge_proposal(p_proposal_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.proposals%rowtype;
  v_version_id uuid;
begin
  select * into v_proposal from public.proposals where id = p_proposal_id;
  if not found then
    raise exception '제안을 찾을 수 없어요.';
  end if;
  if not public.is_project_owner(v_proposal.project_id, auth.uid()) then
    raise exception '소유자만 제안을 반영할 수 있어요.';
  end if;
  if v_proposal.status <> 'proposed' then
    raise exception '이미 처리된 제안이에요.';
  end if;

  insert into public.versions
    (user_id, project_id, label, video_path, duration_sec, pose_data, covers_start_sec, covers_end_sec)
  values
    (v_proposal.author_id, v_proposal.project_id, v_proposal.title, v_proposal.video_path,
     v_proposal.duration_sec, v_proposal.pose_data, v_proposal.start_sec, v_proposal.end_sec)
  returning id into v_version_id;

  update public.proposals
  set status = 'merged', decided_by = auth.uid(), decided_at = now()
  where id = p_proposal_id;

  return v_version_id;
end;
$$;

grant execute on function public.merge_proposal(uuid) to authenticated;
