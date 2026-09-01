-- ============================================================
-- 미수행 알림: 매일 밤 10시(한국시간)에 서버가 스스로 확인
-- "오늘 관리가 3개 미만인 어르신"의 보호자에게 알림을 남긴다
-- 사용법: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run
-- ============================================================

-- 1. 확인 함수: 오늘(한국 날짜) 완료가 3개 미만이고,
--    연결된 보호자가 있는 어르신에게 'missed' 알림 생성 (하루 1번만)
create or replace function public.flag_missed_routines()
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into alerts (elder_id, type, detail)
  select
    p.id,
    'missed',
    '오늘 틀니 관리가 늦어지고 있어요 (완료 ' || coalesce(l.done, 0) || '/' || r.total || ')'
  from profiles p
  join (
    select user_id, count(*) as total
    from routines where enabled
    group by user_id
  ) r on r.user_id = p.id
  left join (
    select user_id, count(*) as done
    from routine_logs
    where log_date = (now() at time zone 'Asia/Seoul')::date
    group by user_id
  ) l on l.user_id = p.id
  where p.role = 'A1'
    and coalesce(l.done, 0) < 3
    and exists (
      select 1 from care_links c
      where c.elder_id = p.id and c.status = 'active'
    )
    and not exists (
      select 1 from alerts a
      where a.elder_id = p.id
        and a.type = 'missed'
        and (a.created_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date
    );
end;
$$;

-- 2. 스케줄러 켜기 + 매일 22:00 KST(= 13:00 UTC)에 실행 예약
create extension if not exists pg_cron;

select cron.schedule(
  'flag-missed-routines',
  '0 13 * * *',
  $$ select public.flag_missed_routines() $$
);
