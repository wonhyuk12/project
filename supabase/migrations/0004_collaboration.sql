-- 협업 기능: 프로젝트에 소유자 외 멤버를 추가할 수 있게 한다. 초대는 이메일이 아니라
-- 공유 가능한 링크(project_invites.id가 토큰)로 한다.

-- ---------------------------------------------------------------------------
-- 테이블 먼저 전부 만든다(정책이 서로를 참조하므로 순서가 중요함).
-- ---------------------------------------------------------------------------
create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table if not exists public.project_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  project_title text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

alter table public.project_members enable row level security;
alter table public.project_invites enable row level security;

-- ---------------------------------------------------------------------------
-- project_members 정책
-- ---------------------------------------------------------------------------
create policy "project_members_select" on public.project_members
  for select using (
    user_id = auth.uid()
    or project_id in (select id from public.projects where user_id = auth.uid())
  );

create policy "project_members_insert_self" on public.project_members
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.project_invites i
      where i.project_id = project_members.project_id and i.expires_at > now()
    )
  );

-- ---------------------------------------------------------------------------
-- project_invites 정책 — 토큰(id) 자체가 보안 경계라, 로그인한 사용자면 누구나 행을
-- 읽을 수 있어야 초대 수락 화면(비멤버)이 프로젝트 이름을 보여줄 수 있다.
-- ---------------------------------------------------------------------------
create policy "project_invites_select_any_authenticated" on public.project_invites
  for select using (auth.uid() is not null);

create policy "project_invites_insert_owner" on public.project_invites
  for insert with check (
    created_by = auth.uid()
    and exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  );

create policy "project_invites_delete_owner" on public.project_invites
  for delete using (
    exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- projects / versions / compare_runs: select(+ versions/compare_runs insert)를
-- "소유자이거나 멤버"로 넓힌다. 기존 정책을 지우고 다시 만든다.
-- ---------------------------------------------------------------------------
drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own_or_member" on public.projects
  for select using (
    auth.uid() = user_id
    or id in (select project_id from public.project_members where user_id = auth.uid())
  );

drop policy if exists "versions_select_own" on public.versions;
create policy "versions_select_own_or_member" on public.versions
  for select using (
    auth.uid() = user_id
    or project_id in (select project_id from public.project_members where user_id = auth.uid())
  );

drop policy if exists "versions_insert_own" on public.versions;
create policy "versions_insert_own_or_member" on public.versions
  for insert with check (
    auth.uid() = user_id
    and (
      exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
      or exists (
        select 1 from public.project_members pm
        where pm.project_id = versions.project_id and pm.user_id = auth.uid()
      )
    )
  );

drop policy if exists "compare_runs_select_own" on public.compare_runs;
create policy "compare_runs_select_own_or_member" on public.compare_runs
  for select using (
    auth.uid() = user_id
    or project_id in (select project_id from public.project_members where user_id = auth.uid())
  );

drop policy if exists "compare_runs_insert_own" on public.compare_runs;
create policy "compare_runs_insert_own_or_member" on public.compare_runs
  for insert with check (
    auth.uid() = user_id
    and (
      exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
      or exists (
        select 1 from public.project_members pm
        where pm.project_id = compare_runs.project_id and pm.user_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- storage.objects(videos 버킷): 업로드한 본인 + 그 파일이 속한 프로젝트의 멤버도 재생 가능.
-- ---------------------------------------------------------------------------
drop policy if exists "videos_select_own" on storage.objects;
create policy "videos_select_own_or_shared" on storage.objects
  for select using (
    bucket_id = 'videos' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.versions v
        join public.project_members pm on pm.project_id = v.project_id
        where v.video_path = name and pm.user_id = auth.uid()
      )
      or exists (
        select 1 from public.compare_runs cr
        join public.project_members pm on pm.project_id = cr.project_id
        where (cr.ref_video ->> 'video_path') = name and pm.user_id = auth.uid()
      )
    )
  );
