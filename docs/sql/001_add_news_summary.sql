-- 001_add_news_summary.sql
-- 실행 위치: Supabase 대시보드 > SQL Editor > New query > 붙여넣고 Run
--
-- 배경:
--   소식 목록/홈 카드에 뿌리는 "요약 문구"를 프론트에서 본문(body) 첫 문단을 잘라
--   만들고 있었다. 요약은 화면 표시용 콘텐츠이므로 파생시키지 않고 DB가 갖는다.
--   (디자인의 카드 문구는 본문 첫 문단과 실제로 다르다 — 파생으로는 재현 불가)
--
-- 안전: 컬럼 추가만 하며 기존 데이터를 지우지 않는다. 여러 번 실행해도 안전(if not exists).

alter table news
  add column if not exists summary text not null default '';

comment on column news.summary is '목록/홈 카드용 한 줄 요약. 비어 있으면 화면에서 생략.';
