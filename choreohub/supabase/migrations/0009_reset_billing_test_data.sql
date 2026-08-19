-- 테스트하면서 쌓인 결제 시도 기록/상태를 깨끗하게 초기화한다.
delete from public.billing_charges;
update public.profiles set plan = 'free', pro_expires_at = null;
