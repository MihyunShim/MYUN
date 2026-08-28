import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../state/AuthContext';
import type { Routine, RoutineLog } from '../lib/types';
import { Screen, Title, Card, Splash } from '../components/ui';

interface CheckupRow { visited_on: string; next_recall_on: string; }

// A2 주간 리포트 (docs/설계/01 A2-2, 프로토타입 renderA2Report 계승)
// 지난 7일(오늘 제외) 기준: 완료율, 요일별 그래프, 놓친 시간대 패턴, 다음 검진
export default function ReportA2() {
  const { elderId } = useAuth();
  const [elderName, setElderName] = useState('');
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [logs, setLogs] = useState<RoutineLog[]>([]);
  const [checkup, setCheckup] = useState<CheckupRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!elderId) return;
      const since = new Date();
      since.setDate(since.getDate() - 14);
      const sinceStr = since.toISOString().slice(0, 10);
      const [p, r, l, c] = await Promise.all([
        db().from('profiles').select('name').eq('id', elderId).single(),
        db().from('routines').select('*').eq('user_id', elderId).order('alarm_time'),
        db().from('routine_logs').select('*').eq('user_id', elderId).gte('log_date', sinceStr),
        db().from('checkups').select('visited_on,next_recall_on').eq('user_id', elderId)
          .order('visited_on', { ascending: false }).limit(1).maybeSingle(),
      ]);
      setElderName((p.data as { name: string } | null)?.name ?? '');
      setRoutines((r.data as Routine[]) ?? []);
      setLogs((l.data as RoutineLog[]) ?? []);
      setCheckup((c.data as CheckupRow) ?? null);
      setLoading(false);
    })();
  }, [elderId]);

  if (loading) return <Splash text="리포트를 만드는 중..." />;

  const total = routines.length;
  const dateStr = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const dayLabel = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    return '일월화수목금토'[d.getDay()];
  };

  // 이번 주(어제까지 7일) vs 지난주(그 전 7일) — 오늘은 아직 진행 중이라 제외
  const inWindow = (log: RoutineLog, from: number, to: number) => {
    for (let i = from; i <= to; i++) if (log.log_date === dateStr(i)) return true;
    return false;
  };
  const thisWeek = logs.filter((l) => inWindow(l, 1, 7));
  const lastWeek = logs.filter((l) => inWindow(l, 8, 14));
  const rate = total ? Math.round((thisWeek.length / (total * 7)) * 100) : 0;
  const prevRate = total ? Math.round((lastWeek.length / (total * 7)) * 100) : 0;
  const diff = rate - prevRate;

  // 요일별 (어제부터 7일 전까지 → 오래된 날이 왼쪽)
  const days = [7, 6, 5, 4, 3, 2, 1].map((off) => ({
    label: dayLabel(off),
    done: thisWeek.filter((l) => l.log_date === dateStr(off)).length,
  }));

  // 시간대별 놓친 횟수 (이번 주 7일 기준)
  const slotMisses = routines.map((r) => ({
    routine: r,
    missed: 7 - thisWeek.filter((l) => l.slot === r.slot).length,
  }));
  const worst = [...slotMisses].sort((a, b) => b.missed - a.missed)[0];

  const dDay = checkup
    ? Math.ceil((new Date(checkup.next_recall_on + 'T00:00:00').getTime() - Date.now()) / 86400000)
    : null;

  return (
    <Screen>
      <Title sub={elderName ? `${elderName}님의 지난 7일` : '지난 7일'}>주간 리포트</Title>

      {/* 이번 주 완료율 */}
      <Card style={{ background: 'var(--primary)', color: '#fff', textAlign: 'center' }}>
        <p style={{ opacity: 0.85 }}>이번 주 완료율</p>
        <p style={{ fontSize: 48, fontWeight: 800, lineHeight: 1.2 }}>{rate}%</p>
        <p style={{ opacity: 0.85 }}>
          {lastWeek.length > 0
            ? diff === 0 ? '지난주와 같아요' : `지난주 ${prevRate}% 대비 ${diff > 0 ? '+' : ''}${diff}%p`
            : '첫 주 기록이에요'}
        </p>
      </Card>

      {/* 요일별 수행률 */}
      <Card>
        <p style={{ fontWeight: 800, marginBottom: 14 }}>요일별 수행</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 110 }}>
          {days.map((d, i) => {
            const ratio = total ? d.done / total : 0;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: '100%', borderRadius: 6,
                  height: Math.max(6, ratio * 70),
                  background: ratio >= 1 ? 'var(--success)' : ratio >= 0.6 ? 'var(--accent)' : ratio > 0 ? 'var(--warning)' : 'var(--border)',
                }} />
                <span style={{ fontSize: 14, color: 'var(--text-sub)' }}>{d.label}</span>
                <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>{d.done}/{total}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 놓친 시간대 패턴 */}
      <Card>
        <p style={{ fontWeight: 800, marginBottom: 10 }}>자주 놓치는 시간</p>
        {worst && worst.missed > 0 ? (
          <p style={{ color: 'var(--text-sub)', marginBottom: 12 }}>
            이번 주 가장 자주 놓친 시간은{' '}
            <strong style={{ color: 'var(--text)' }}>
              {worst.routine.label}({worst.routine.alarm_time.slice(0, 5)})
            </strong>
            이에요. 그 시간에 전화 한 통이 큰 힘이 됩니다.
          </p>
        ) : (
          <p style={{ color: 'var(--success)', fontWeight: 700, marginBottom: 12 }}>
            모든 시간을 잘 지키고 있어요! 👏
          </p>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          {slotMisses.map(({ routine, missed }) => (
            <div key={routine.slot} style={{
              flex: 1, padding: '8px 4px', borderRadius: 8, textAlign: 'center',
              background: missed > 2 ? '#FEE2E2' : missed > 0 ? '#FEF3C7' : '#DCFCE7',
            }}>
              <p style={{ fontSize: 14, color: 'var(--text-sub)' }}>{routine.alarm_time.slice(0, 5)}</p>
              <p style={{ fontSize: 15, fontWeight: 700 }}>{missed > 0 ? `${missed}회 놓침` : '완벽'}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* 다음 검진 */}
      <Card style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontWeight: 800 }}>🦷 다음 치과 검진</p>
        {dDay !== null ? (
          <p style={{ fontWeight: 800, color: dDay <= 7 ? 'var(--danger)' : 'var(--primary)' }}>
            {dDay < 0 ? `${-dDay}일 지남!` : dDay === 0 ? '오늘!' : `D-${dDay}`}
          </p>
        ) : (
          <p style={{ color: 'var(--text-sub)' }}>기록 없음</p>
        )}
      </Card>
    </Screen>
  );
}
