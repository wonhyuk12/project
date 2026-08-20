-- 0013에서 compare_runs insert를 versions와 똑같이 can_edit_project(='직접 수정'만)로 좁혔는데,
-- 비교/실시간 연습은 "공유 안무를 수정"하는 게 아니라 각자 개인 연습 결과를 기록하는 거라
-- '보기만'/'수정 제안' 멤버도 할 수 있어야 한다. 이 제약 때문에 실시간 연습 저장이
-- (versions insert는 물론 compare_runs insert까지 막혀서) 조용히 실패하고 있었다.
-- versions는 실제 공유 콘텐츠라 can_edit_project 제약을 그대로 유지한다.
drop policy if exists "compare_runs_insert_own_or_member" on public.compare_runs;
create policy "compare_runs_insert_own_or_member" on public.compare_runs
  for insert with check (
    auth.uid() = user_id and public.has_project_access(project_id, auth.uid())
  );
