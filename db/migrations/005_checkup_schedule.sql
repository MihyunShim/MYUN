-- 담당 치과에서 안내받은 일정. 기존 자동 계산 검진 기록과 분리한다.
-- 001~004 적용 후 실행. 운영 DB 적용은 별도 절차로 진행한다.
begin;
-- 자동 주기를 새로 만들지 않고 실제 방문일만 기록할 수 있게 한다.
-- 이전 계산값은 삭제하거나 예약일로 변환하지 않는다.
alter table public.checkups alter column next_recall_on drop not null;
alter table public.checkups alter column interval_months drop not null;
create table public.checkup_schedules (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  scheduled_on date not null check (scheduled_on between date '1900-01-01' and date '9999-12-31')
);
alter table public.checkup_schedules enable row level security;
revoke all on public.checkup_schedules from public, anon, authenticated;
grant select, insert, update, delete on public.checkup_schedules to authenticated;
create policy "schedule read" on public.checkup_schedules for select to authenticated
  using (user_id = auth.uid() or public.is_guardian_of(user_id));
create policy "schedule create" on public.checkup_schedules for insert to authenticated
  with check (user_id = auth.uid());
create policy "schedule edit" on public.checkup_schedules for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "schedule remove" on public.checkup_schedules for delete to authenticated
  using (user_id = auth.uid());
commit;
