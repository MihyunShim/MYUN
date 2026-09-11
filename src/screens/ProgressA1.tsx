import { useCallback, useEffect, useState } from 'react';
import { db, friendlyError } from '../lib/db';
import { localDateString } from '../lib/dates';
import { useRefreshOnResume } from '../lib/useRefreshOnResume';
import { useAuth } from '../state/AuthContext';
import { computeStreak, weeklyStats } from '../lib/streak';
import type { Routine, RoutineLog } from '../lib/types';
import { Screen, Title, Card, Splash, ErrorBox, BigButton } from '../components/ui';

// A1 진행률 화면 (docs/설계/01 A1-3): 연속 일수, 습관화 단계, 주간 그래프
export default function ProgressA1() {
  const { session } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [logs, setLogs] = useState<RoutineLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      if (!session) return;
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const sinceStr = localDateString(since);
      const [r, l] = await Promise.all([
        db().from('routines').select('*').eq('user_id', session.user.id).eq('enabled', true),
        db().from('routine_logs').select('*').eq('user_id', session.user.id).gte('log_date', sinceStr),
      ]);
      if (r.error || l.error) throw r.error || l.error;
      setError('');
      setRoutines((r.data as Routine[]) ?? []);
      const slots = new Set((r.data as Routine[] ?? []).map((routine) => routine.slot));
      setLogs(((l.data as RoutineLog[]) ?? []).filter((log) => slots.has(log.slot)));
    } catch (err) { setError(friendlyError(err)); }
    finally { setLoading(false); }
  }, [session]);
  useEffect(() => { void load(); }, [load]);
  useRefreshOnResume(load);

  if (loading) return <Splash text="진행률을 불러오는 중..." />;
  if (error) return <Screen><Title>나의 진행률</Title><ErrorBox message={error} /><BigButton onClick={load}>다시 불러오기</BigButton></Screen>;

  const streak = computeStreak(logs, routines.length);
  const week = weeklyStats(logs);
  // 습관화 단계: 30일/90일 기준 (프로토타입 계승)
  const phase = streak < 30 ? 1 : streak < 90 ? 2 : 3;
  const phaseLabel = ['기록 시작 (1~29일)', '꾸준한 기록 (30~89일)', '오랜 기록 (90일+)'][phase - 1];
  const phaseEmoji = ['🌱', '🌿', '🌳'][phase - 1];

  return (
    <Screen>
      <Title sub="매일 남긴 관리 기록을 확인해요">나의 진행률</Title>

      <Card style={{ textAlign: 'center', background: 'var(--primary-light)' }}>
        <p style={{ fontSize: 48 }}>{phaseEmoji}</p>
        <p style={{ fontSize: 34, fontWeight: 800, color: 'var(--primary)' }}>{streak}일 연속</p>
        <p style={{ color: 'var(--text-sub)', marginTop: 4 }}>
          {phase}단계 · {phaseLabel}
        </p>
      </Card>

      <Card>
        <p style={{ fontWeight: 800, marginBottom: 14 }}>최근 7일</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 120 }}>
          {week.map((d, i) => {
            const ratio = routines.length ? d.done / routines.length : 0;
            const isToday = i === 6;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: '100%', borderRadius: 8,
                  height: Math.max(8, ratio * 90),
                  background: ratio >= 1 ? 'var(--success)' : ratio > 0 ? 'var(--accent)' : 'var(--border)',
                }} />
                <span style={{ fontSize: 14, fontWeight: isToday ? 800 : 400, color: isToday ? 'var(--primary)' : 'var(--text-sub)' }}>
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
        <p style={{ color: 'var(--text-sub)', fontSize: 15, marginTop: 10 }}>
          초록 = 설정된 관리 모두 완료 · 주황 = 일부 완료
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
