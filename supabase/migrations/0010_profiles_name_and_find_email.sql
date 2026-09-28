-- 회원가입 시 이름도 같이 받아서 저장하고, 전화번호로 가입 이메일(아이디)을 찾을 수 있게
-- 마스킹된 이메일을 돌려주는 RPC를 추가한다.

alter table public.profiles add column if not exists name text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, phone, name)
  values (new.id, new.raw_user_meta_data ->> 'phone', new.raw_user_meta_data ->> 'name')
  on conflict (id) do update set phone = excluded.phone, name = excluded.name;
  return new;
end;
$$;

-- profiles에는 이메일이 없어서(auth.users에만 있음) 전화번호로 찾으려면 auth.users를
-- 조인해야 하는데, auth 스키마는 RLS로 직접 조회가 안 된다 — SECURITY DEFINER로 감싸서
-- 이 함수 안에서만 우회하고, 이메일은 마스킹된 형태로만 돌려준다(비로그인 상태에서도
-- 호출되므로 원문 이메일을 그대로 노출하면 안 됨).
create or replace function public.find_masked_email_by_phone(p_phone text)
returns text
language sql
security definer
set search_path = public, auth
stable
as $$
  select
    left(u.email, 2)
    || repeat('*', greatest(position('@' in u.email) - 3, 1))
    || substring(u.email from position('@' in u.email))
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.phone = p_phone
  limit 1;
$$;

grant execute on function public.find_masked_email_by_phone(text) to anon, authenticated;
