-- Read-only. true indicates existence, not an end-to-end permission or delivery test.
select
  to_regclass('public.profiles') is not null as profiles_ready,
  to_regprocedure('public.list_my_care_links()') is not null as account_update_ready,
  to_regprocedure('public.delete_own_account()') is not null as account_delete_ready,
  to_regclass('public.checkup_schedules') is not null as checkup_schedule_ready,
  to_regprocedure('public.request_guardian_connection(text,text)') is not null as guardian_approval_ready,
  to_regprocedure('public.save_checkup_visit(date,uuid,date)') is not null as visit_edit_ready,
  to_regprocedure('public.delete_checkup_visit(uuid,date)') is not null as visit_delete_ready;
