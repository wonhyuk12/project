-- 0017에서 '사전승인 필요'로 넣었는데, chisung42 App.tsx의 실제 License 타입은
-- '상업 이용 협의'다. UI 쪽이 기준이므로 DB 체크 제약을 맞춘다.
alter table public.projects drop constraint if exists projects_license_check;
alter table public.projects add constraint projects_license_check
  check (license in ('연습 전용', '비상업 커버 허용', '리믹스 허용', '상업 이용 협의'));
