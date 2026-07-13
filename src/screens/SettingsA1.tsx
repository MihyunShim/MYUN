import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../state/AuthContext';
import type { Routine } from '../lib/types';
import { Screen, Title, Card, BigButton, Splash } from '../components/ui';

// A1 설정 화면 (docs/설계/01 A1-6): 글자 크기, 알림 시간, 초대코드, 로그아웃
export default function SettingsA1() {
  const { session, profile, refresh, signOut } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      if (!session) return;
      const { data } = await db().from('routines').select('*').eq('user_id', session.user.id).order('alarm_time');
      setRoutines((data as Routine[]) ?? []);
      setLoading(false);
    })();
  }, [session]);

  if (loading) return <Splash text="설정을 불러오는 중..." />;

  const setFontMode = async (mode: 'normal' | 'large') => {
    if (!session) return;
    await db().from('profiles').update({ font_size_mode: mode }).eq('id', session.user.id);
    await refresh(); // App이 글자 크기를 즉시 반영
  };

  const updateTime = async (r: Routine, time: string) => {
    setRoutines(routines.map((x) => (x.id === r.id ? { ...x, alarm_time: time } : x)));
    await db().from('routines').update({ alarm_time: time }).eq('id', r.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const fontMode = profile?.font_size_mode ?? 'normal';

  return (
    <Screen>
      <Title>설정</Title>

      <Card>
        <p style={{ fontWeight: 800, marginBottom: 10 }}>🔎 글자 크기</p>
        <div style={{ display: 'flex', gap: 10 }}>
          {([['normal', '보통'], ['large', '크게']] as const).map(([mode, label]) => (
            <button key={mode} onClick={() => setFontMode(mode)} style={{
              flex: 1, minHeight: 52, fontWeight: 700,
              background: fontMode === mode ? 'var(--primary)' : 'var(--primary-light)',
              color: fontMode === mode ? '#fff' : 'var(--primary)',
            }}>
              {label}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <p style={{ fontWeight: 800, marginBottom: 4 }}>⏰ 알림 시간</p>
        <p style={{ color: 'var(--text-sub)', fontSize: 15, marginBottom: 10 }}>
          바꾸면 바로 저장돼요 {saved && <strong style={{ color: 'var(--success)' }}>· 저장됨 ✓</strong>}
        </p>
        {routines.map((r) => (
          <div key={r.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0',
          }}>
            <span style={{ fontWeight: 700 }}>{r.label}</span>
            <input
              type="time"
              value={r.alarm_time.slice(0, 5)}
              onChange={(e) => updateTime(r, e.target.value)}
              style={{ fontSize: 18, padding: 8, border: '2px solid var(--border)', borderRadius: 10 }}
            />
          </div>
        ))}
      </Card>

      <Card style={{ textAlign: 'center', background: 'var(--primary-light)' }}>
        <p style={{ fontWeight: 800 }}>💗 가족 초대코드</p>
        <p style={{ fontSize: 30, fontWeight: 800, letterSpacing: 6, color: 'var(--primary)', margin: '8px 0' }}>
          {profile?.invite_code ?? '------'}
        </p>
        <p style={{ color: 'var(--text-sub)', fontSize: 15 }}>
          가족이 이 코드를 입력하면 관리 현황을 함께 볼 수 있어요
        </p>
      </Card>

      <BigButton variant="ghost" onClick={signOut}>로그아웃</BigButton>
    </Screen>
  );
}
