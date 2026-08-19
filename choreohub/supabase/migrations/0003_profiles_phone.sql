-- 회원가입 시 입력한 연락처를 profiles에 같이 저장한다.
alter table public.profiles add column if not exists phone text;

-- signUp()의 options.data.phone으로 넘어온 값을 가입과 동시에 profiles.phone에 채워 넣도록
-- handle_new_user()를 갱신한다(0002에서 만든 트리거 함수 재정의).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, new.raw_user_meta_data ->> 'phone')
  on conflict (id) do update set phone = excluded.phone;
  return new;
end;
$$;
