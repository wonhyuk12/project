-- 긴급 수정: projects 정책이 project_members를 참조하고, project_members 정책이 다시
-- projects를 참조해서 RLS 평가 시 무한 순환이 발생했다(select 자체가 500으로 죽음).
-- SECURITY DEFINER 함수로 멤버십/소유권 확인을 감싸서, 그 안에서는 RLS를 안 타게 만들어
-- 순환을 끊는다(Supabase에서 이런 상호참조 RLS를 만들 때 표준적으로 쓰는 방법).

create or replace function public.is_project_owner(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.projects
    where id = p_project_id and user_id = p_user_id
  );
$$;

create or replace function public.is_project_member(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = p_user_id
  );
$$;

create or replace function public.has_project_access(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_project_owner(p_project_id, p_user_id)
    or public.is_project_member(p_project_id, p_user_id);
$$;

-- project_members: projects 직접 조회 대신 is_project_owner() 사용
drop policy if exists "project_members_select" on public.project_members;
create policy "project_members_select" on public.project_members
  for select using (
    user_id = auth.uid() or public.is_project_owner(project_id, auth.uid())
  );

-- projects: project_members 직접 조회 대신 is_project_member() 사용
drop policy if exists "projects_select_own_or_member" on public.projects;
create policy "projects_select_own_or_member" on public.projects
  for select using (
    auth.uid() = user_id or public.is_project_member(id, auth.uid())
  );

-- versions / compare_runs도 같은 헬퍼로 통일(순환은 없었지만 일관성 + 성능 위해 정리)
drop policy if exists "versions_select_own_or_member" on public.versions;
create policy "versions_select_own_or_member" on public.versions
  for select using (
    auth.uid() = user_id or public.is_project_member(project_id, auth.uid())
  );

drop policy if exists "versions_insert_own_or_member" on public.versions;
create policy "versions_insert_own_or_member" on public.versions
  for insert with check (
    auth.uid() = user_id and public.has_project_access(project_id, auth.uid())
  );

drop policy if exists "compare_runs_select_own_or_member" on public.compare_runs;
create policy "compare_runs_select_own_or_member" on public.compare_runs
  for select using (
    auth.uid() = user_id or public.is_project_member(project_id, auth.uid())
  );

drop policy if exists "compare_runs_insert_own_or_member" on public.compare_runs;
create policy "compare_runs_insert_own_or_member" on public.compare_runs
  for insert with check (
    auth.uid() = user_id and public.has_project_access(project_id, auth.uid())
  );

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
    )
  );

drop policy if exists "profiles_select_shared_project" on public.profiles;
create policy "profiles_select_shared_project" on public.profiles
  for select using (
    exists (
      select 1 from public.project_members my
      where my.user_id = auth.uid() and public.is_project_member(my.project_id, profiles.id)
    )
    or exists (
      select 1 from public.projects p
      where p.user_id = auth.uid() and public.is_project_member(p.id, profiles.id)
    )
    or exists (
      select 1 from public.project_members pm
      where pm.user_id = auth.uid() and public.is_project_owner(pm.project_id, profiles.id)
    )
  );
