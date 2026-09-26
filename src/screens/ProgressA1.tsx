import { useLatestRead } from '../lib/useLatestRead';
import { useCallback, useEffect, useState } from 'react';
import { db, friendlyError } from '../lib/db';
import { localDateString } from '../lib/dates';
import { useRefreshOnResume } from '../lib/useRefreshOnResume';
import { useAuth } from '../state/AuthContext';
import { computeStreak, weeklyStats, PROGRESS_WINDOW_DAYS } from '../lib/streak';
import type { Routine, RoutineLog } from '../lib/types';
import { Screen, Title, Card, Splash, ErrorBox, BigButton } from '../components/ui';

// 최근 90일 관리 기록과 최근 7일 완료 현황
export default function ProgressA1() {
  const { session } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [logs, setLogs] = useState<RoutineLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const beginRead = useLatestRead(session?.user.id);
  const load = useCallback(async () => {
    const request = beginRead();
    try {
      if (!session) return;
      const since = new Date();
      since.setDate(since.getDate() - (PROGRESS_WINDOW_DAYS - 1));
      const sinceStr = localDateString(since);
      const [r, l] = await Promise.all([
        db().from('routines').select('*').eq('user_id', session.user.id).eq('enabled', true).abortSignal(request.signal),
        db().from('routine_logs').select('*').eq('user_id', session.user.id).gte('log_date', sinceStr).lte('log_date', localDateString()).abortSignal(request.signal),
      ]);
      if (!request.isCurrent()) return;
      if (r.error || l.error) throw r.error || l.error;
      setError('');
      setRoutines((r.data as Routine[]) ?? []);
      const slots = new Set((r.data as Routine[] ?? []).map((routine) => routine.slot));
      setLogs(((l.data as RoutineLog[]) ?? []).filter((log) => slots.has(log.slot)));
    } catch (err) { if (request.isCurrent()) setError(friendlyError(err)); }
    finally { if (request.isCurrent()) setLoading(false); }
  }, [session?.user.id, beginRead]);
  useEffect(() => { void load(); }, [load]);
  useRefreshOnResume(load);

  if (loading) return <Splash text="진행률을 불러오는 중..." />;
  if (error) return <Screen><Title>나의 진행률</Title><ErrorBox message={error} /><BigButton onClick={load}>다시 불러오기</BigButton></Screen>;

  const enabledSlots = [...new Set(routines.map((routine) => routine.slot))];
  const totalSlots = enabledSlots.length;
  const streak = computeStreak(logs, enabledSlots);
  const week = weeklyStats(logs, enabledSlots);
  const phaseLabel = streak === 0 ? '오늘부터 기록해보세요'
    : streak < 30 ? '기록 시작 (1~29일)'
    : streak < 90 ? '꾸준한 기록 (30~89일)' : '90일 기록 달성';
  const phaseEmoji = streak < 30 ? '🌱' : streak < 90 ? '🌿' : '🌳';

  return (
    <Screen>
      <Title sub="매일 남긴 관리 기록을 확인해요">나의 진행률</Title>

      <Card style={{ textAlign: 'center', background: 'var(--primary-light)' }}>
        <p aria-hidden="true" style={{ fontSize: 48 }}>{phaseEmoji}</p>
        <p style={{ fontSize: 'calc(var(--font-body) * 1.8)', fontWeight: 800, color: 'var(--primary)' }}>{streak}일 연속</p>
        <p style={{ color: 'var(--text-sub)', marginTop: 4 }}>
          {phaseLabel}
        </p>
        <p style={{ color: 'var(--text-sub)', marginTop: 12 }}>최근 90일 안의 기록만 집계해요. 오늘 진행 중이면 어제까지의 연속 기록을 표시해요.</p>
      </Card>

      <Card>
        <h2 style={{ fontSize: 'inherit', fontWeight: 800, marginBottom: 14 }}>최근 7일</h2>
        {totalSlots === 0 && <p>현재 집계할 관리 항목이 없어요.</p>}
        <ul role="list" aria-label="최근 7일 관리 완료 기록" style={{ listStyle: 'none', display: 'grid', gap: 14 }}>
          {week.map((day) => {
            const ratio = totalSlots ? day.done / totalSlots : 0;
            return (
              <li key={day.date}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '2px 8px' }}>
                  <span style={{ fontWeight: day.isToday ? 800 : 400 }}>
                    {day.label}{day.isToday ? ' · 오늘' : ''}
                  </span>
                  <span>{!totalSlots ? '관리 항목 없음' : day.hasRecords ? `${day.done}/${totalSlots}개 완료 기록` : day.isToday ? '아직 기록 없음' : '기록 없음'}</span>
                </div>
                <div aria-hidden="true" style={{ marginTop: 4, height: 10, borderRadius: 8, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{ width: `${ratio * 100}%`, height: '100%', background: ratio >= 1 ? 'var(--success)' : 'var(--accent)' }} />
                </div>
              </li>
            );
          })}
        </ul>
        <p style={{ color: 'var(--text-sub)', marginTop: 14 }}>
          기록이 없다고 관리를 하지 않은 것은 아니에요. 현재 켜진 관리 항목을 기준으로 계산해요. 항목 설정을 바꾸면 이전 날짜의 완료 수와 연속 일수도 달라질 수 있어요.
        </p>
      </Card>

      <Card>
        <p style={{ fontWeight: 800, marginBottom: 6 }}>💡 알고 계셨나요?</p>
        <p style={{ color: 'var(--text-sub)' }}>
          기록을 빠뜨린 날이 있어도 오늘부터 다시 시작해보세요. 기록 단계는 앱의 격려 표시이며 건강 상태를 평가하지 않아요.
        </p>
      </Card>
    </Screen>
  );
}
