-- chisung42 프론트를 Supabase 백엔드에 연결하기 위한 스키마 확장.
-- (계획 문서: scratchpad/chisung42-to-supabase-plan.md 참고)

-- ---------------------------------------------------------------------------
-- 1) 라이선스 복원 — 0015에서 지웠던 걸 다시 추가한다. 이번엔 실제로 커뮤니티 피드
--    필터링("연습 전용"이 아닌 것만 공개)이라는 소비처가 생겨서 정당화된다.
-- ---------------------------------------------------------------------------
alter table public.projects
  add column if not exists license text not null default '연습 전용'
    check (license in ('연습 전용', '비상업 커버 허용', '리믹스 허용', '사전승인 필요'));

-- ---------------------------------------------------------------------------
-- 2) 짧은 초대 코드 — chisung42 UI는 URL 링크가 아니라 "CHO-XXXX" 코드 입력 방식.
--    기존 URL 토큰(project_invites.id) 방식은 그대로 두고 컬럼만 추가한다.
-- ---------------------------------------------------------------------------
alter table public.project_invites
  add column if not exists short_code text unique;

-- ---------------------------------------------------------------------------
-- 3) "초대는 했지만 아직 참여 전"인 협업자를 이름만으로 미리 등록할 수 있게 한다
--    (chisung42의 collaborators.user_id NULL + joined=0 패턴).
--    project_members는 지금 (project_id, user_id) 복합 PK라 user_id를 NULL로 못 둔다 —
--    surrogate id로 바꾸고, user_id가 있는 행끼리만 유일하도록 부분 유니크 인덱스로 대체한다.
-- ---------------------------------------------------------------------------
alter table public.project_members drop constraint project_members_pkey;
alter table public.project_members add column id uuid primary key default gen_random_uuid();
alter table public.project_members alter column user_id drop not null;
alter table public.project_members add column if not exists invited_name text;
create unique index if not exists project_members_project_user_unique
  on public.project_members(project_id, user_id)
  where user_id is not null;

-- ---------------------------------------------------------------------------
-- 4) 팔로우(커뮤니티 기능) — 완전히 새 테이블.
-- ---------------------------------------------------------------------------
create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
alter table public.follows enable row level security;

create policy "follows_select_all" on public.follows
  for select using (true);
create policy "follows_insert_own" on public.follows
  for insert with check (follower_id = auth.uid());
create policy "follows_delete_own" on public.follows
  for delete using (follower_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5) 커뮤니티 피드/프로필 열람 — license가 "연습 전용"이 아닌 프로젝트의 소유자는
--    누구나(로그인만 하면) 프로필을 볼 수 있게 한다. 기존 "같은 프로젝트 멤버끼리만"
--    정책(profiles_select_shared_project, profiles_select_own)에 추가되는 것뿐이라
--    범위를 좁히지 않는다.
-- ---------------------------------------------------------------------------
create policy "profiles_select_public_creators" on public.profiles
  for select using (
    auth.uid() is not null
    and exists (
      select 1 from public.projects p
      where p.user_id = profiles.id and p.license <> '연습 전용'
    )
  );

-- ---------------------------------------------------------------------------
-- 6) 커뮤니티 피드에서 프로젝트를 공개적으로 조회할 수 있게 한다(license 기준).
--    지금 projects_select_own_or_member는 소유자/멤버만 select 가능 — 공개 라이선스는
--    누구나(로그인만 하면) 볼 수 있게 넓힌다.
-- ---------------------------------------------------------------------------
create policy "projects_select_public_license" on public.projects
  for select using (auth.uid() is not null and license <> '연습 전용');

-- 참고: practice_runs는 새 테이블을 만들지 않는다 — 기존 compare_runs.result->>'overallScore'로
-- 충분히 대체 가능하다(계획 문서 참고).
