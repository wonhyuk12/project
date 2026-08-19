-- 0011에서 이메일 오타(fappyeni1234 -> fappyenie1234)로 못 찾았던 계정 보정.
update public.profiles p
set name = '멋사토끼'
from auth.users u
where p.id = u.id
  and u.email = 'fappyenie1234@gmail.com';
