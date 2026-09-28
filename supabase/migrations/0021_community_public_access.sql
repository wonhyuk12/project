-- 커뮤니티 공개 기능: 좋아요, 다운로드/사용 허가 요청, 인앱 알림.
-- (전체공개 프로젝트/버전 자체는 0020에서 이미 열람 가능하게 해뒀다.)

-- ---------------------------------------------------------------------------
-- 1) 좋아요
-- ---------------------------------------------------------------------------
create table if not exists public.project_likes (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
alter table public.project_likes enable row level security;

create policy "project_likes_select_all" on public.project_likes
  for select using (true);
create policy "project_likes_insert_own" on public.project_likes
  for insert with check (user_id = auth.uid());
create policy "project_likes_delete_own" on public.project_likes
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2) 다운로드/사용 허가 요청
-- ---------------------------------------------------------------------------
create table if not exists public.project_access_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('다운로드', '사용')),
  status text not null default '대기' check (status in ('대기', '승인', '거절')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (project_id, requester_id, type)
);
alter table public.project_access_requests enable row level security;

create policy "access_requests_select_own_or_owner" on public.project_access_requests
  for select using (
    requester_id = auth.uid()
    or exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3) 인앱 알림
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());
create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4) 요청 생성/승인 RPC — 요청자가 소유자 앞으로 알림을 직접 insert할 순 없어야 하므로
--    (notifications엔 본인 앞 insert 정책이 없음) SECURITY DEFINER로 감싸서
--    "요청 생성 + 소유자 알림"을 한 트랜잭션으로 처리한다.
-- ---------------------------------------------------------------------------
create or replace function public.request_project_access(p_project_id uuid, p_type text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_owner_id uuid;
  v_title text;
  v_is_public boolean;
  v_requester_name text;
  v_request_id uuid;
begin
  if p_type not in ('다운로드', '사용') then
    raise exception '잘못된 요청 종류예요.';
  end if;

  select user_id, title, is_public into v_owner_id, v_title, v_is_public
  from public.projects where id = p_project_id;

  if v_owner_id is null then
    raise exception '프로젝트를 찾을 수 없어요.';
  end if;
  if not v_is_public then
    raise exception '비공개 프로젝트는 요청할 수 없어요.';
  end if;
  if v_owner_id = auth.uid() then
    raise exception '본인 프로젝트에는 요청할 수 없어요.';
  end if;

  insert into public.project_access_requests (project_id, requester_id, type)
  values (p_project_id, auth.uid(), p_type)
  on conflict (project_id, requester_id, type)
    do update set status = '대기', decided_at = null, created_at = now()
  returning id into v_request_id;

  select name into v_requester_name from public.profiles where id = auth.uid();

  insert into public.notifications (user_id, type, title, body, link)
  values (
    v_owner_id,
    'access_request',
    p_type || ' 요청이 왔어요',
    coalesce(v_requester_name, '누군가') || '님이 "' || v_title || '" ' || p_type || '을(를) 요청했어요.',
    '/projects/' || p_project_id || '/requests'
  );

  return v_request_id;
end;
$$;

grant execute on function public.request_project_access(uuid, text) to authenticated;

create or replace function public.decide_project_access_request(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_project_id uuid;
  v_owner_id uuid;
  v_requester_id uuid;
  v_type text;
  v_title text;
begin
  select r.project_id, r.requester_id, r.type, p.user_id, p.title
    into v_project_id, v_requester_id, v_type, v_owner_id, v_title
  from public.project_access_requests r
  join public.projects p on p.id = r.project_id
  where r.id = p_request_id;

  if v_owner_id is null then
    raise exception '요청을 찾을 수 없어요.';
  end if;
  if v_owner_id <> auth.uid() then
    raise exception '이 요청을 처리할 권한이 없어요.';
  end if;

  update public.project_access_requests
  set status = case when p_approve then '승인' else '거절' end, decided_at = now()
  where id = p_request_id;

  insert into public.notifications (user_id, type, title, body, link)
  values (
    v_requester_id,
    'access_decision',
    '"' || v_title || '" ' || v_type || ' 요청이 ' || (case when p_approve then '승인' else '거절' end) || '됐어요',
    null,
    '/projects/' || v_project_id
  );
end;
$$;

grant execute on function public.decide_project_access_request(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) 스토리지: 전체공개 프로젝트의 영상은 로그인한 누구나 재생(select)할 수 있게 한다.
--    ⚠️ 스트리밍 가능 = 사실상 저장(다운로드)도 막을 수 없다(서명 URL을 얻으면 브라우저에서
--    바로 저장 가능) — "다운로드 허가"는 UI에서 다운로드 버튼 노출 여부를 승인 여부로
--    가리는 수준의 보호이지, 암호학적으로 막는 게 아니라는 점을 감안해야 한다.
-- ---------------------------------------------------------------------------
create policy "videos_select_public_project" on storage.objects
  for select using (
    bucket_id = 'videos'
    and auth.uid() is not null
    and exists (
      select 1 from public.versions v
      join public.projects p on p.id = v.project_id
      where v.video_path = storage.objects.name and p.is_public = true
    )
  );
