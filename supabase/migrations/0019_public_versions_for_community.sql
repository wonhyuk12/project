-- 6단계(Community/Profile)에서 공개 프로젝트(license != '연습 전용')를 구경할 때
-- versions(포즈 프레임 수, 영상)도 봐야 하는데, 지금 versions SELECT 정책은 멤버십만
-- 확인해서 공개 프로젝트라도 비멤버는 못 본다. projects/profiles에 이미 추가해둔
-- "공개 라이선스면 로그인만 하면 열람 가능" 정책을 versions에도 똑같이 추가한다.
create policy "versions_select_public_license" on public.versions
  for select using (
    auth.uid() is not null
    and exists (
      select 1 from public.projects p
      where p.id = versions.project_id and p.license <> '연습 전용'
    )
  );
