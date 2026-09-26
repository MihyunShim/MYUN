import { useLatestRead } from '../lib/useLatestRead';
import { useCallback, useEffect, useState } from 'react';
import { db, friendlyError } from '../lib/db';
import { localDateString, calendarDaysUntil } from '../lib/dates';
import { nextCheckup, type CheckupSchedule } from '../lib/checkups';
import { reportWeek } from '../lib/report';
import { useRefreshOnResume } from '../lib/useRefreshOnResume';
import { useAuth } from '../state/AuthContext';
import type { Routine, RoutineLog } from '../lib/types';
import { Screen, Title, Card, Splash, ErrorBox, BigButton } from '../components/ui';

interface CheckupRow { visited_on: string; next_recall_on: string | null; }

// A2 주간 리포트 (docs/설계/01 A2-2, 프로토타입 renderA2Report 계승)
// 지난 7일(오늘 제외) 기준: 완료율, 요일별 그래프, 놓친 시간대 패턴, 다음 검진
export default function ReportA2() {
  const { elderId } = useAuth();
  const [elderName, setElderName] = useState('');
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [logs, setLogs] = useState<RoutineLog[]>([]);
  const [checkup, setCheckup] = useState<CheckupRow | null>(null);
  const [schedule, setSchedule] = useState<CheckupSchedule | null>(null);
  const [scheduleError, setScheduleError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const beginRead = useLatestRead(elderId);
  const load = useCallback(async () => {
    const request = beginRead();
    try {
      if (!elderId) return;
      const since = new Date();
      since.setDate(since.getDate() - 14);
      const sinceStr = localDateString(since);
      const [p, r, l, c, planned] = await Promise.all([
        db().rpc('get_care_profile', { elder: elderId }).abortSignal(request.signal),
        db().from('routines').select('*').eq('user_id', elderId).eq('enabled', true).order('alarm_time').abortSignal(request.signal),
        db().from('routine_logs').select('*').eq('user_id', elderId).gte('log_date', sinceStr).lte('log_date', localDateString()).abortSignal(request.signal),
        db().from('checkups').select('visited_on,next_recall_on').eq('user_id', elderId)
          .order('visited_on', { ascending: false }).limit(1).abortSignal(request.signal).maybeSingle(),
        db().from('checkup_schedules').select('user_id,scheduled_on').eq('user_id', elderId).abortSignal(request.signal).maybeSingle(),
      ]);
      if (!request.isCurrent()) return;
      if (p.error || r.error || l.error || c.error) throw p.error || r.error || l.error || c.error;
      if (!p.data) {
        setElderName(''); setRoutines([]); setLogs([]); setCheckup(null); setSchedule(null);
        setError('가족의 개인정보 공유 동의를 기다리고 있어요. 틀니 사용자 앱의 설정에서 공유 동의를 확인·갱신해주세요.'); return;
      }
      setError('');
      setScheduleError(planned.error ? '치과에서 안내받은 일정을 불러오지 못했어요.' : '');
      setSchedule(planned.error ? null : planned.data as CheckupSchedule | null);
      setElderName((p.data as { name: string } | null)?.name ?? '');
      setRoutines((r.data as Routine[]) ?? []);
      const slots = new Set((r.data as Routine[] ?? []).map((routine) => routine.slot));
      setLogs(((l.data as RoutineLog[]) ?? []).filter((log) => slots.has(log.slot)));
      setCheckup((c.data as CheckupRow) ?? null);
    } catch (err) { if (request.isCurrent()) setError(friendlyError(err)); }
    finally { if (request.isCurrent()) setLoading(false); }
  }, [elderId, beginRead]);
  useEffect(() => { void load(); }, [load]);
  useRefreshOnResume(load);

  if (loading) return <Splash text="리포트를 만드는 중..." />;
  if (error) return <Screen><Title>주간 리포트</Title><ErrorBox message={error} /><BigButton onClick={load}>다시 불러오기</BigButton></Screen>;

  const slots = routines.map(r => r.slot);
  const week = reportWeek(logs, slots);
  const previous = reportWeek(logs, slots, new Date(), 8);
  const { total, rate, days } = week;
  const diff = rate !== null && previous.rate !== null ? rate - previous.rate : null;

  const next = nextCheckup(schedule, checkup?.next_recall_on);
  const dDay = next?.confirmed ? calendarDaysUntil(next.date) : null;

  return (
    <Screen>
      <Title sub={elderName ? `${elderName}님의 지난 7일` : '지난 7일'}>주간 리포트</Title>

      <Card style={{ background: 'var(--primary)', color: '#fff', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1em' }}>지난 7일 완료 기록률</h2>
        <p style={{ fontSize: 40, fontWeight: 800 }}>{rate === null ? total ? '기록 없음' : '관리 항목 없음' : `${rate}%`}</p>
        <p>{diff === null ? '비교할 기록이 충분하지 않아요' : diff === 0 ? '이전 7일과 같아요' : `이전 7일 ${previous.rate}% 대비 ${diff > 0 ? '+' : ''}${diff}%p`}</p>
      </Card>
      <p>오늘을 제외한 7일 동안 앱에 남긴 기록이에요. 현재 켜진 관리 항목 × 7일을 기준으로 계산하므로, 처음 사용하거나 항목을 바꾸면 실제 관리 실천과 다를 수 있어요. 기록이 없다고 관리를 하지 않은 것은 아니에요.</p>
      <Card>
        <h2 style={{ fontSize: '1.1em', marginBottom: 12 }}>날짜별 완료 기록</h2>
        <ul aria-label="지난 7일 가족 관리 기록" style={{ listStyle: 'none', display: 'grid', gap: 14 }}>
          {days.map(day => <li key={day.date}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
              <span>{day.label}</span><span>{!total ? '관리 항목 없음' : day.done ? `${day.done}/${total}개 완료 기록` : '기록 없음'}</span>
            </div>
            <div aria-hidden="true" style={{ height: 10, marginTop: 4, background: 'var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${total ? day.done / total * 100 : 0}%`, background: 'var(--primary)' }} />
            </div>
          </li>)}
        </ul>
      </Card>
      <Card>
        <h2 style={{ fontSize: '1.1em', marginBottom: 10 }}>시간대별 기록 확인</h2>
        <p>기록이 비어 있는 시간은 가족에게 직접 확인해주세요.</p>
        {!total ? <p>현재 관리 항목이 없어요.</p> : !week.done ? <p>이 기간에는 완료 기록이 없어요.</p> : <ul style={{ listStyle: 'none' }}>
          {week.missing.map(({ slot, count }) => {
            const routine = routines.find(r => r.slot === slot)!;
            return <li key={slot} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <strong>{routine.label} · {routine.alarm_time.slice(0, 5)}</strong>
              <p>{count ? `7일 중 ${count}일 기록 없음` : '7일 모두 완료 기록 있음'}</p>
            </li>;
          })}
        </ul>}
      </Card>

      {/* 다음 검진 */}
      <Card>
        <p style={{ fontWeight: 800 }}>🦷 {next?.label ?? '다음 치과 검진'}</p>
        <ErrorBox message={scheduleError} />
        {scheduleError && <BigButton variant="ghost" onClick={load}>일정 다시 불러오기</BigButton>}
        {!scheduleError && next && <p>{next.date}</p>}
        {scheduleError ? null : dDay !== null ? (
          <p style={{ fontWeight: 800, color: dDay <= 7 ? 'var(--danger)' : 'var(--primary)' }}>
            {dDay < 0 ? `${-dDay}일 지남!` : dDay === 0 ? '오늘!' : `D-${dDay}`}
          </p>
        ) : (
          <p style={{ color: 'var(--text-sub)' }}>{next ? '안내받은 검진일 미입력' : '기록 없음'}</p>
        )}
        {next && !next.confirmed && <p>검증되지 않은 기존 앱 계산값이며 치과 예약일이 아니에요. 담당 치과에 실제 일정을 확인해 주세요.</p>}
        {next?.confirmed && <p>사용자가 치과에서 안내받아 입력한 일정이에요.</p>}
      </Card>
    </Screen>
  );
}
