-- 완료 취소(되돌리기) 기능용: 본인의 루틴 기록을 삭제할 수 있게 허용
-- 사용법: Supabase SQL Editor에 붙여넣고 Run
create policy "log undo" on public.routine_logs
  for delete using (user_id = auth.uid());
