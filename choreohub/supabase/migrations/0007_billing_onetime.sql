-- 자동결제(빌링)는 토스 쪽 심사/계약이 필요해서 지금 당장은 못 쓴다. 대신 결제위젯으로
-- 1회성 결제(30일 이용권)를 받는 방식으로 바꾼다 — Pro 만료 시점을 저장해둔다.
alter table public.profiles add column if not exists pro_expires_at timestamptz;
