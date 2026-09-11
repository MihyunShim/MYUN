import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { db, friendlyError } from '../lib/db';
import { useAuth } from '../state/AuthContext';
import type { Routine } from '../lib/types';
import { calculateRecall } from '../lib/recall';
import { enableNotifications, notificationPermission, scheduleRoutines, sendTestNotification, type NotificationPermission, routineNotificationStatus, type RoutineNotificationStatus } from '../lib/notifications';
import { Screen, Title, Card, BigButton, Field, Splash, ErrorBox } from '../components/ui';
import { isValidTime } from '../lib/dates';
import { useRefreshOnResume } from '../lib/useRefreshOnResume';
import { VoiceNotificationControls } from '../components/VoiceNotificationControls';
import DentureDateFields from '../components/DentureDateFields';
import { AccountActions, AppInformation } from '../components/AccountActions';

// A1 설정 화면 (docs/설계/01 A1-6): 알림, 글자 크기, 알림 시간, 틀니 정보, 초대코드, 로그아웃
export default function SettingsA1() {
  const { session, profile, refresh, signOut } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [notifState, setNotifState] = useState<NotificationPermission>('prompt');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<RoutineNotificationStatus | null>(null);

  // 틀니 정보 수정
  const [madeYear, setMadeYear] = useState('');
  const [madeMonth, setMadeMonth] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [clinicPhone, setClinicPhone] = useState('');
  const [dentureSaved, setDentureSaved] = useState(false);

  const load = useCallback(async () => {
      if (!session) return;
      setError('');
      try {
      const [r, d, perm] = await Promise.all([
        db().from('routines').select('*').eq('user_id', session.user.id).order('alarm_time'),
        db().from('dentures').select('*').eq('user_id', session.user.id).maybeSingle(),
        notificationPermission(),
      ]);
      if (r.error || d.error) throw r.error || d.error;
      setRoutines((r.data as Routine[]) ?? []);
      if (d.data) {
        setMadeYear(String(d.data.made_year));
        setMadeMonth(String(d.data.made_month));
        setClinicName(d.data.clinic_name ?? '');
        setClinicPhone(d.data.clinic_phone ?? '');
      }
      setNotifState(perm);
      if (Capacitor.isNativePlatform() && perm === 'granted') {
        setNotificationStatus(await routineNotificationStatus((r.data as Routine[]) ?? []));
      } else setNotificationStatus(null);
      } catch (err) { setError(friendlyError(err)); }
      finally { setLoading(false); }
  }, [session]);
  useEffect(() => { void load(); }, [load]);
  const refreshPermission = useCallback(async () => {
    try {
      const permission = await notificationPermission();
      setNotifState(permission);
      if (Capacitor.isNativePlatform() && permission === 'granted') {
        setNotificationStatus(await routineNotificationStatus(routines));
      } else setNotificationStatus(null);
    }
    catch { setError('알림 설정을 확인하지 못했어요. 잠시 후 다시 시도해주세요.'); }
  }, [routines]);
  useRefreshOnResume(refreshPermission);

  if (loading) return <Splash text="설정을 불러오는 중..." />;

  const setFontMode = async (mode: 'normal' | 'large') => {
    if (!session) return;
    setError('');
    try {
      const result = await db().from('profiles').update({ font_size_mode: mode }).eq('id', session.user.id).select('id').single();
      if (result.error) throw result.error;
      await refresh();
    } catch (err) { setError(friendlyError(err)); }
  };

  const updateTime = async (r: Routine, time: string) => {
    if (busy || testBusy || voiceBusy) return;
    if (!isValidTime(time)) { setError('관리 시간을 다시 골라주세요.'); return; }
    setError('');
    setSaved(false);
    setBusy(true);
    try {
    const next = routines.map((x) => (x.id === r.id ? { ...x, alarm_time: time } : x));
    const result = await db().from('routines').update({ alarm_time: time }).eq('id', r.id).select('id').single();
    if (result.error) throw result.error;
    setRoutines(next);
    setSaved(true);
    setNotificationStatus(null);
    try {
      const applied = await scheduleRoutines(next);
      if (Capacitor.isNativePlatform() && applied) setNotificationStatus(await routineNotificationStatus(next));
      setNotifState(await notificationPermission());
    }
    catch { setError('시간은 저장했지만 알림을 바꾸지 못했어요. 알림 다시 적용을 눌러주세요.'); }
    } catch (err) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  };

  const turnOnNotifications = async () => {
    setError('');
    setBusy(true);
    setNotificationStatus(null);
    try {
      const applied = await enableNotifications(routines);
      setNotifState(await notificationPermission());
      if (Capacitor.isNativePlatform() && applied) setNotificationStatus(await routineNotificationStatus(routines));
      else if ((await notificationPermission()) === 'granted') setError('알림을 적용하지 못했어요. 다시 시도해주세요.');
    } catch (err) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  };

  const testNotification = async () => {
    setError('');
    setTestSent(false);
    setTestBusy(true);
    try { await sendTestNotification(); setTestSent(true); }
    catch (err) { setError(friendlyError(err)); }
    finally { setTestBusy(false); }
  };

  const saveDenture = async () => {
    if (!session) return;
    if (!recallPreview) { setError('제작 연도와 월을 확인해주세요. 미래 날짜는 입력할 수 없어요.'); return; }
    setError('');
    setDentureSaved(false);
    setBusy(true);
    try {
    const result = await db().from('dentures').upsert({
      user_id: session.user.id,
      made_year: Number(madeYear),
      made_month: Number(madeMonth),
      clinic_name: clinicName.trim() || null,
      clinic_phone: clinicPhone.trim() || null,
    }, { onConflict: 'user_id' });
    if (result.error) throw result.error;
    setDentureSaved(true);
    } catch (err) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  };

  const recallPreview = /^\d{4}$/.test(madeYear) && /^([1-9]|1[0-2])$/.test(madeMonth)
    ? calculateRecall(Number(madeYear), Number(madeMonth)) : null;
  const fontMode = profile?.font_size_mode ?? 'normal';

  return (
    <Screen>
      <Title>설정</Title>
      <ErrorBox message={error} />
      {error && <BigButton variant="ghost" onClick={load} disabled={busy}>설정 다시 불러오기</BigButton>}

      <Card>
        <p style={{ fontWeight: 800, marginBottom: 6 }}>🔔 관리 시간 알림</p>
        {Capacitor.getPlatform() === 'ios' && <VoiceNotificationControls disabled={busy || testBusy}
          onBusyChange={setVoiceBusy} onChange={() => { setNotificationStatus(null); setTestSent(false); setError(''); }} />}
        {notifState === 'granted' ? (
          <>
            <p style={{ color: 'var(--success)', fontWeight: 700 }}>알림이 허용되어 있어요 ✓</p>
            {Capacitor.isNativePlatform() && <p role="status" style={{ margin: '8px 0', color: notificationStatus?.verified ? 'var(--success)' : 'var(--text-sub)' }}>
              {notificationStatus?.verified
                ? notificationStatus.expected > 0 ? `매일 알림 ${notificationStatus.scheduled}개 예약을 기기에서 확인했어요.` : '사용 중인 관리 시간 알림이 없어요.'
                : notificationStatus ? `기기에서 ${notificationStatus.expected}개 중 ${notificationStatus.scheduled}개 예약을 확인했어요. 다시 적용해주세요.` : '기기의 예약 상태를 아직 확인하지 못했어요.'}
            </p>}
            <BigButton variant="ghost" onClick={turnOnNotifications} disabled={busy || testBusy || voiceBusy}>{busy ? '알림 준비 중...' : '알림 다시 적용'}</BigButton>
            {Capacitor.isNativePlatform() && <BigButton variant="ghost" onClick={testNotification} disabled={busy || testBusy || voiceBusy}>{testBusy ? '시험 알림 준비 중...' : '10초 후 시험 알림'}</BigButton>}
            {testSent && <p role="status">10초 후 시험 알림을 요청했어요. 홈 화면으로 나가거나 화면을 잠가 확인해주세요.</p>}
            {Capacitor.isNativePlatform() && <p style={{ marginTop: 8, color: 'var(--text-sub)' }}>예약이 있어도 집중 모드나 알림 요약 설정에 따라 표시가 늦어질 수 있어요. 시험 알림이 보이지 않으면 아이폰 설정에서 틀니케어의 잠금 화면·소리 허용을 확인해주세요.</p>}
          </>
        ) : notifState === 'unsupported' ? (
          <p>이 환경은 관리 시간 알림을 지원하지 않아요. 아이폰 앱에서 이용해주세요.</p>
        ) : (<>
          <p style={{ color: 'var(--text-sub)', marginBottom: 10 }}>
            매일 관리 시간에 "틀니 닦을 시간이에요"라고 알려드려요
          </p>
          <BigButton onClick={turnOnNotifications} disabled={busy}>알림 받기</BigButton>
          {notifState === 'denied' && (
            <p style={{ color: 'var(--danger)', fontSize: 15, marginTop: 8 }}>
              알림이 차단돼 있어요. 폰의 설정 앱에서 틀니케어 알림을 허용해주세요.
            </p>
          )}
        </>)}
        {!Capacitor.isNativePlatform() && <p style={{ fontSize: 15, marginTop: 8 }}>브라우저에서는 이 화면이 열려 있을 때만 알림을 받을 수 있어요.</p>}
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
              aria-label={`${r.label} 알림 시간`}
              disabled={busy}
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
          제작 시기를 기록해둘 수 있어요. 검진 일정은 치과 검진 화면에서 입력해주세요.
          {dentureSaved && <strong style={{ color: 'var(--success)' }}> · 저장됨 ✓</strong>}
        </p>
        <DentureDateFields year={madeYear} month={madeMonth} disabled={busy}
          onYearChange={(value) => { setMadeYear(value); setDentureSaved(false); }}
          onMonthChange={(value) => { setMadeMonth(value); setDentureSaved(false); }} />
        <div style={{ display: 'grid', gap: 12, margin: '12px 0' }}>
          <Field label="다니는 치과" value={clinicName} onChange={(value) => { setClinicName(value); setDentureSaved(false); }} placeholder="예) 튼튼치과" />
          <Field label="치과 전화번호" value={clinicPhone} onChange={(value) => { setClinicPhone(value); setDentureSaved(false); }} inputMode="tel" placeholder="예) 02-123-4567" />
        </div>
        {recallPreview && (
          <p style={{ color: 'var(--primary)', fontWeight: 700, marginBottom: 12 }}>
            {recallPreview.phase}
          </p>
        )}
        <BigButton onClick={saveDenture} disabled={busy || !recallPreview}>
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
      <AppInformation />
      <AccountActions />
    </Screen>
  );
}
