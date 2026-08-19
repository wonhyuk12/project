-- name 컬럼이 생기기 전에 가입한 기존 계정 2개에 이름을 채워 넣는다.
update public.profiles p
set name = case u.email
  when 'fappyeni1234@gmail.com' then '멋사토끼'
  when 'wonhyuk8944@gmail.com' then '멋사호랑이'
end
from auth.users u
where p.id = u.id
  and u.email in ('fappyeni1234@gmail.com', 'wonhyuk8944@gmail.com');
