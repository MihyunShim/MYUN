import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../state/AuthContext';
import type { Routine } from '../lib/types';
import { calculateRecall } from '../lib/recall';
import { enableNotifications, notificationPermission, scheduleRoutines } from '../lib/notifications';
import { Screen, Title, Card, BigButton, Field, Splash } from '../components/ui';

// A1 설정 화면 (docs/설계/01 A1-6): 알림, 글자 크기, 알림 시간, 틀니 정보, 초대코드, 로그아웃
export default function SettingsA1() {
  const { session, profile, refresh, signOut } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [notifState, setNotifState] = useState<'granted' | 'denied' | 'prompt'>('prompt');

  // 틀니 정보 수정
  const [madeYear, setMadeYear] = useState('');
  const [madeMonth, setMadeMonth] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [clinicPhone, setClinicPhone] = useState('');
  const [dentureSaved, setDentureSaved] = useState(false);

  useEffect(() => {
    (async () => {
      if (!session) return;
      const [r, d, perm] = await Promise.all([
        db().from('routines').select('*').eq('user_id', session.user.id).order('alarm_time'),
        db().from('dentures').select('*').eq('user_id', session.user.id).maybeSingle(),
        notificationPermission(),
      ]);
      setRoutines((r.data as Routine[]) ?? []);
      if (d.data) {
        setMadeYear(String(d.data.made_year));
        setMadeMonth(String(d.data.made_month));
        setClinicName(d.data.clinic_name ?? '');
        setClinicPhone(d.data.clinic_phone ?? '');
      }
      setNotifState(perm);
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
    const next = routines.map((x) => (x.id === r.id ? { ...x, alarm_time: time } : x));
    setRoutines(next);
    await db().from('routines').update({ alarm_time: time }).eq('id', r.id);
    await scheduleRoutines(next); // 알림 예약도 새 시간으로 갱신
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const turnOnNotifications = async () => {
    const ok = await enableNotifications(routines);
    setNotifState(ok ? 'granted' : 'denied');
  };

  const saveDenture = async () => {
    if (!session) return;
    await db().from('dentures').upsert({
      user_id: session.user.id,
      made_year: parseInt(madeYear),
      made_month: parseInt(madeMonth),
      clinic_name: clinicName.trim() || null,
      clinic_phone: clinicPhone.trim() || null,
    }, { onConflict: 'user_id' });
    setDentureSaved(true);
    setTimeout(() => setDentureSaved(false), 2000);
  };

  const recallPreview = calculateRecall(parseInt(madeYear), parseInt(madeMonth));
  const fontMode = profile?.font_size_mode ?? 'normal';

  return (
    <Screen>
      <Title>설정</Title>

      <Card>
        <p style={{ fontWeight: 800, marginBottom: 6 }}>🔔 관리 시간 알림</p>
        {notifState === 'granted' ? (
          <p style={{ color: 'var(--success)', fontWeight: 700 }}>켜져 있어요 ✓</p>
        ) : (<>
          <p style={{ color: 'var(--text-sub)', marginBottom: 10 }}>
            매일 관리 시간에 "틀니 닦을 시간이에요"라고 알려드려요
          </p>
          <BigButton onClick={turnOnNotifications}>알림 받기</BigButton>
          {notifState === 'denied' && (
            <p style={{ color: 'var(--danger)', fontSize: 15, marginTop: 8 }}>
              알림이 차단돼 있어요. 폰의 설정 앱에서 틀니케어 알림을 허용해주세요.
            </p>
          )}
        </>)}
      </Card>

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

      <Card>
        <p style={{ fontWeight: 800, marginBottom: 4 }}>🦷 틀니 정보</p>
        <p style={{ color: 'var(--text-sub)', fontSize: 15, marginBottom: 12 }}>
          제작 시기가 바뀌면 검진 주기도 다시 계산돼요
          {dentureSaved && <strong style={{ color: 'var(--success)' }}> · 저장됨 ✓</strong>}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <Field label="만든 연도" value={madeYear} onChange={setMadeYear} inputMode="numeric" placeholder="2024" />
          <Field label="만든 월" value={madeMonth} onChange={setMadeMonth} inputMode="numeric" placeholder="3" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
          <Field label="다니는 치과" value={clinicName} onChange={setClinicName} placeholder="예) 튼튼치과" />
          <Field label="치과 전화번호" value={clinicPhone} onChange={setClinicPhone} inputMode="tel" placeholder="예) 02-123-4567" />
        </div>
        {recallPreview && (
          <p style={{ color: 'var(--primary)', fontWeight: 700, marginBottom: 12 }}>
            → 「{recallPreview.phase}」 · 검진 주기 {recallPreview.intervalMonths}개월
          </p>
        )}
        <BigButton onClick={saveDenture} disabled={madeYear.length !== 4 || !madeMonth}>
          틀니 정보 저장
        </BigButton>
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
