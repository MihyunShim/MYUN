-- Read-only. true indicates existence, not an end-to-end permission or delivery test.
select
  to_regclass('public.profiles') is not null as profiles_ready,
  to_regprocedure('public.list_my_care_links()') is not null as account_update_ready,
  to_regprocedure('public.delete_own_account()') is not null as account_delete_ready,
  to_regclass('public.checkup_schedules') is not null as checkup_schedule_ready,
  to_regprocedure('public.request_guardian_connection(text,text)') is not null as guardian_approval_ready,
  to_regprocedure('public.save_checkup_visit(date,uuid,date)') is not null as visit_edit_ready,
  to_regprocedure('public.delete_checkup_visit(uuid,date)') is not null as visit_delete_ready,
  to_regprocedure('public.accept_privacy_consent(jsonb)') is not null as privacy_consent_ready,
  to_regprocedure('public.approve_guardian_with_consent(uuid,text,boolean,boolean)') is not null as separate_sharing_ready,
  to_regprocedure('public.withdraw_health_consent()') is not null as privacy_withdrawal_ready;
-- After 008: select public.get_privacy_notice(); must return the operator-reviewed document, not null.
