import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../state/AuthContext';
import { computeStreak, weeklyStats } from '../lib/streak';
import type { Routine, RoutineLog } from '../lib/types';
import { Screen, Title, Card, Splash } from '../components/ui';

// A1 진행률 화면 (docs/설계/01 A1-3): 연속 일수, 습관화 단계, 주간 그래프
export default function ProgressA1() {
  const { session } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [logs, setLogs] = useState<RoutineLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!session) return;
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const sinceStr = since.toISOString().slice(0, 10);
      const [r, l] = await Promise.all([
        db().from('routines').select('*').eq('user_id', session.user.id),
        db().from('routine_logs').select('*').eq('user_id', session.user.id).gte('log_date', sinceStr),
      ]);
      setRoutines((r.data as Routine[]) ?? []);
      setLogs((l.data as RoutineLog[]) ?? []);
      setLoading(false);
    })();
  }, [session]);

  if (loading) return <Splash text="진행률을 불러오는 중..." />;

  const streak = computeStreak(logs, routines.length);
  const week = weeklyStats(logs);
  // 습관화 단계: 30일/90일 기준 (프로토타입 계승)
  const phase = streak < 30 ? 1 : streak < 90 ? 2 : 3;
  const phaseLabel = ['습관 만들기 (1~29일)', '습관 다지기 (30~89일)', '몸에 뱄어요! (90일+)'][phase - 1];
  const phaseEmoji = ['🌱', '🌿', '🌳'][phase - 1];

  return (
    <Screen>
      <Title sub="꾸준함이 잇몸 건강을 지켜요">나의 진행률</Title>

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
          초록 = 5개 모두 완료 · 주황 = 일부 완료
        </p>
      </Card>

      <Card>
        <p style={{ fontWeight: 800, marginBottom: 6 }}>💡 알고 계셨나요?</p>
        <p style={{ color: 'var(--text-sub)' }}>
          같은 행동을 66일 정도 반복하면 몸이 기억해요. 지금처럼만 하시면 틀니 관리가 양치질처럼 자연스러워져요.
        </p>
      </Card>
    </Screen>
  );
}
