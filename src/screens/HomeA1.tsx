import { useEffect, useState, useCallback } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../state/AuthContext';
import { SLOT_DETAIL, todayStr, type Routine, type RoutineLog } from '../lib/types';
import { Screen, Card, BigButton, Splash } from '../components/ui';

// A1 홈: 오늘 할 일 (docs/설계/01 A1-1, A1-2 통합 초기 버전)
export default function HomeA1() {
  const { session, profile, signOut } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [logs, setLogs] = useState<RoutineLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const uid = session.user.id;
    const [r, l] = await Promise.all([
      db().from('routines').select('*').eq('user_id', uid).order('alarm_time'),
      db().from('routine_logs').select('*').eq('user_id', uid).eq('log_date', todayStr()),
    ]);
    setRoutines((r.data as Routine[]) ?? []);
    setLogs((l.data as RoutineLog[]) ?? []);
    setLoading(false);
  }, [session]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Splash text="오늘 할 일을 불러오는 중..." />;

  const doneSlots = new Set<string>(logs.map((l) => l.slot));
  const done = routines.filter((r) => doneSlots.has(r.slot)).length;
  const next = routines.find((r) => !doneSlots.has(r.slot));

  const check = async (slot: string) => {
    if (!session || doneSlots.has(slot)) return;
    setChecking(slot);
    // 서버에 기록 — 하루 1번 제약(unique)이 중복을 막아줌
    await db().from('routine_logs').insert({ user_id: session.user.id, slot });
    await load();
    setChecking(null);
  };

  const today = new Date();
  const dateLabel = `${today.getMonth() + 1}월 ${today.getDate()}일 ${'일월화수목금토'[today.getDay()]}요일`;

  return (
    <Screen>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ color: 'var(--text-sub)' }}>{dateLabel}</p>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>
            {profile?.name ? `${profile.name}님, 안녕하세요!` : '안녕하세요!'}
          </h1>
        </div>
        <button onClick={signOut} style={{
          background: 'none', color: 'var(--text-sub)', fontSize: 15,
          textDecoration: 'underline', minHeight: 44,
        }}>
          로그아웃
        </button>
      </div>

      {/* 오늘 진행률 */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontWeight: 700 }}>오늘의 관리</span>
          <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{done} / {routines.length} 완료</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {routines.map((r) => (
            <div key={r.slot} style={{
              flex: 1, height: 12, borderRadius: 6,
              background: doneSlots.has(r.slot) ? 'var(--success)' : 'var(--border)',
            }} />
          ))}
        </div>
        {done === routines.length && routines.length > 0 && (
          <p style={{ marginTop: 12, fontWeight: 800, color: 'var(--success)', textAlign: 'center' }}>
            오늘 관리를 모두 마쳤어요! 정말 잘하셨어요 👏
          </p>
        )}
      </Card>

      {/* 지금 할 일 (가장 큰 카드) */}
      {next && (
        <Card style={{ borderColor: 'var(--primary)', borderWidth: 2 }}>
          <p style={{ color: 'var(--primary)', fontWeight: 800 }}>
            ⏰ {next.alarm_time.slice(0, 5)} · {next.label}
          </p>
          <p style={{ fontSize: 22, fontWeight: 800, margin: '10px 0 4px' }}>
            {SLOT_DETAIL[next.slot].action}
          </p>
          <p style={{ color: 'var(--text-sub)', marginBottom: 16 }}>
            🧴 {SLOT_DETAIL[next.slot].tool}
          </p>
          <BigButton onClick={() => check(next.slot)} disabled={checking === next.slot}>
            {checking === next.slot ? '기록 중...' : '했어요 ✓'}
          </BigButton>
        </Card>
      )}

      {/* 전체 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {routines.map((r) => {
          const isDone = doneSlots.has(r.slot);
          return (
            <Card key={r.slot} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px', opacity: isDone ? 0.75 : 1,
            }}>
              <span style={{ fontSize: 26 }}>{isDone ? '✅' : '⬜'}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700 }}>{r.alarm_time.slice(0, 5)} · {r.label}</p>
                <p style={{ color: 'var(--text-sub)', fontSize: 16 }}>{SLOT_DETAIL[r.slot].action}</p>
              </div>
              {!isDone && (
                <button onClick={() => check(r.slot)} style={{
                  background: 'var(--primary-light)', color: 'var(--primary)',
                  fontWeight: 700, padding: '0 18px', minHeight: 48,
                }}>
                  했어요
                </button>
              )}
            </Card>
          );
        })}
      </div>
    </Screen>
  );
}
