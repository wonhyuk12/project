-- 토스페이먼츠 빌링키(자동결제) 연동용 컬럼/테이블.

alter table public.profiles add column if not exists toss_customer_key text;
alter table public.profiles add column if not exists toss_billing_key text;

create table if not exists public.billing_charges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  status text not null check (status in ('succeeded', 'failed')),
  toss_payment_key text,
  toss_order_id text not null,
  failure_reason text,
  created_at timestamptz not null default now()
);

create index if not exists billing_charges_user_id_idx on public.billing_charges(user_id);

alter table public.billing_charges enable row level security;

create policy "billing_charges_select_own" on public.billing_charges
  for select using (auth.uid() = user_id);

create policy "billing_charges_insert_own" on public.billing_charges
  for insert with check (auth.uid() = user_id);
