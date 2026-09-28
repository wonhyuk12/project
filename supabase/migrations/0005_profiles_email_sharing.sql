-- 멤버 목록 화면에서 이메일을 보여주려면 profiles에 이메일을 저장해두고, 같은 프로젝트
-- 멤버끼리는 서로의 프로필(이메일)을 읽을 수 있게 RLS를 넓혀야 한다.

alter table public.profiles add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, phone, email)
  values (new.id, new.raw_user_meta_data ->> 'phone', new.email)
  on conflict (id) do update set phone = excluded.phone, email = excluded.email;
  return new;
end;
$$;

-- 같은 프로젝트(소유자/멤버 무관)에 함께 속한 사람끼리는 서로의 프로필을 볼 수 있게 한다.
create policy "profiles_select_shared_project" on public.profiles
  for select using (
    exists (
      select 1
      from public.project_members my
      join public.project_members their on their.project_id = my.project_id
      where my.user_id = auth.uid() and their.user_id = profiles.id
    )
    or exists (
      select 1 from public.projects p
      where p.user_id = auth.uid()
        and exists (
          select 1 from public.project_members pm
          where pm.project_id = p.id and pm.user_id = profiles.id
        )
    )
    or exists (
      select 1 from public.project_members pm
      join public.projects p on p.id = pm.project_id
      where pm.user_id = auth.uid() and p.user_id = profiles.id
    )
  );
