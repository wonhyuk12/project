-- 0014에서 추가한 projects.license를 걷어낸다 — 이 값을 실제로 쓰는 화면(커뮤니티 탐색 등)을
-- 만들지 않기로 해서, 아무도 읽지 않는 설정값으로만 남아있었다.
alter table public.projects drop column if exists license;
