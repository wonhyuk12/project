-- 프로젝트 업로드 시 비공개/전체공개를 고를 수 있게 한다. 비공개(기본값)는 기존과 동일하게
-- 소유자/멤버만 볼 수 있고(projects_select_own_or_member), 전체공개는 로그인한 사용자
-- 누구나 프로젝트와 그 버전(영상·포즈)을 볼 수 있다.
alter table public.projects add column if not exists is_public boolean not null default false;

create policy "projects_select_public" on public.projects
  for select using (auth.uid() is not null and is_public = true);

create policy "versions_select_public_project" on public.versions
  for select using (
    auth.uid() is not null
    and exists (
      select 1 from public.projects p
      where p.id = versions.project_id and p.is_public = true
    )
  );
