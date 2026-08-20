-- 참고 프로젝트(https://github.com/chisung42/choreohub)의 협업 모델을 참고해, 멤버를 "소유자 아니면
-- 전부 동일 권한"이 아니라 3단계 권한(보기만/수정 제안/직접 수정)으로 나누고, 담당 파트(role)·
-- 담당 구간(counts) 메타데이터를 붙인다 — "누가 무엇을 만들었는지" 기록이라는 프로젝트 목적에 맞춤.

alter table public.project_members
  add column if not exists permission text not null default '수정 제안'
    check (permission in ('보기만', '수정 제안', '직접 수정')),
  add column if not exists role text not null default '',
  add column if not exists counts text not null default '';

-- 소유자는 항상 전체 권한, 멤버는 permission = '직접 수정'일 때만 실제로 쓸 수 있다.
create or replace function public.can_edit_project(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_project_owner(p_project_id, p_user_id)
    or exists (
      select 1 from public.project_members
      where project_id = p_project_id and user_id = p_user_id and permission = '직접 수정'
    );
$$;

-- versions/compare_runs insert: has_project_access(멤버면 무조건 허용) -> can_edit_project(권한 확인)로 조인다.
drop policy if exists "versions_insert_own_or_member" on public.versions;
create policy "versions_insert_own_or_member" on public.versions
  for insert with check (
    auth.uid() = user_id and public.can_edit_project(project_id, auth.uid())
  );

drop policy if exists "compare_runs_insert_own_or_member" on public.compare_runs;
create policy "compare_runs_insert_own_or_member" on public.compare_runs
  for insert with check (
    auth.uid() = user_id and public.can_edit_project(project_id, auth.uid())
  );

-- project_members 관리: 소유자는 아무 멤버나 수정/제거 가능, 멤버 본인은 탈퇴(자기 행 삭제)만 가능.
create policy "project_members_update_owner" on public.project_members
  for update using (
    public.is_project_owner(project_id, auth.uid())
  ) with check (
    public.is_project_owner(project_id, auth.uid())
  );

create policy "project_members_delete_owner_or_self" on public.project_members
  for delete using (
    public.is_project_owner(project_id, auth.uid()) or user_id = auth.uid()
  );
