import { useEffect, useRef, useState } from 'react';
import DentureDateFields from '../components/DentureDateFields';
import { db, friendlyError } from '../lib/db';
import { useAuth } from '../state/AuthContext';
import { DEFAULT_ROUTINES } from '../lib/types';
import { calculateRecall } from '../lib/recall';
import { isValidTime } from '../lib/dates';
import AccountScreen from './AccountScreen';
import { Screen, Title, Card, BigButton, Field, ErrorBox } from '../components/ui';

// A1 온보딩 5단계 (docs/설계/01 A1-0)
// ① 이름·출생연도 → ② 틀니 제작 시기 → ③ 치과 정보 → ④ 알림 시간 → ⑤ 초대코드
export default function Onboarding() {
  const { session, profile, refresh } = useAuth();
  const [step, setStep] = useState(0);
  const [accountOpen, setAccountOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const heading = content.current?.querySelector('h1');
    heading?.setAttribute('tabindex', '-1');
    heading?.focus();
  }, [step, accountOpen]);

  const [name, setName] = useState(profile?.name ?? '');
  const [birthYear, setBirthYear] = useState('');
  const [madeYear, setMadeYear] = useState('');
  const [madeMonth, setMadeMonth] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [clinicPhone, setClinicPhone] = useState('');
  const [times, setTimes] = useState(DEFAULT_ROUTINES.map((r) => r.time));

  const recall = /^\d{4}$/.test(madeYear) && /^([1-9]|1[0-2])$/.test(madeMonth)
    ? calculateRecall(Number(madeYear), Number(madeMonth)) : null;
  const totalSteps = 5;

  const save = async () => {
    if (!session || saving.current) return;
    if (!recall || !times.every(isValidTime)) { setError('틀니 제작 시기와 관리 시간을 다시 확인해주세요.'); return; }
    setError('');
    saving.current = true;
    setBusy(true);
    try {
      const uid = session.user.id;
      const { error: e1 } = await db().from('profiles')
        .update({ name: name.trim(), birth_year: parseInt(birthYear) || null })
        .eq('id', uid);
      if (e1) { setError(friendlyError(e1)); return; }

      const { error: e2 } = await db().from('dentures').upsert({
        user_id: uid,
        made_year: Number(madeYear),
        made_month: Number(madeMonth),
        clinic_name: clinicName.trim() || null,
        clinic_phone: clinicPhone.trim() || null,
      }, { onConflict: 'user_id' });
      if (e2) { setError(friendlyError(e2)); return; }

      const rows = DEFAULT_ROUTINES.map((r, i) => ({
        user_id: uid, slot: r.slot, alarm_time: times[i], label: r.label,
      }));
      const { error: e3 } = await db().from('routines')
        .upsert(rows, { onConflict: 'user_id,slot' });
      if (e3) { setError(friendlyError(e3)); return; }

      await refresh(); // onboarded = true 가 되어 홈으로 이동
    } catch (err) { setError(friendlyError(err)); }
    finally {
      saving.current = false;
      setBusy(false);
    }
  };

  const StepBar = () => (
    <div role="progressbar" aria-label="시작 설정 단계" aria-valuemin={1} aria-valuemax={totalSteps} aria-valuenow={step + 1}
      aria-valuetext={`${totalSteps}단계 중 ${step + 1}단계`} style={{ display: 'flex', gap: 6 }}>
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div key={i} style={{
          flex: 1, height: 8, borderRadius: 4,
          background: i <= step ? 'var(--primary)' : 'var(--border)',
        }} />
      ))}
    </div>
  );

  if (accountOpen) return <AccountScreen onBack={() => setAccountOpen(false)} />;
  return (
    <Screen>
      <div ref={content} style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }} aria-busy={busy}>
      <StepBar />
      <button type="button" disabled={busy} onClick={() => setAccountOpen(true)} style={{ alignSelf: 'flex-end', background: 'none', color: 'var(--primary)' }}>계정·앱 안내</button>

      {step === 0 && (<>
        <Title sub="어떻게 불러드릴까요?">만나서 반가워요!</Title>
        <Field label="이름" value={name} onChange={setName} placeholder="예) 김순자" />
        <Field label="태어난 연도 (선택)" value={birthYear} onChange={setBirthYear} inputMode="numeric" placeholder="예) 1948" />
        <BigButton onClick={() => setStep(1)} disabled={!name.trim() || (!!birthYear && (!/^\d{4}$/.test(birthYear) || Number(birthYear) < 1900 || Number(birthYear) > new Date().getFullYear()))}>다음</BigButton>
      </>)}

      {step === 1 && (<>
        <Title sub="틀니 사용 기간을 기록할 수 있어요. 검진일은 치과 안내에 따라 따로 정해요.">틀니를 언제 만드셨나요?</Title>
        <DentureDateFields year={madeYear} month={madeMonth} onYearChange={setMadeYear} onMonthChange={setMadeMonth} disabled={busy} />
        {recall && (
          <Card style={{ background: 'var(--primary-light)', borderColor: 'var(--primary)' }}>
            <p style={{ fontWeight: 800, color: 'var(--primary)' }}>{recall.phase}</p>
            <p style={{ color: 'var(--text-sub)', marginTop: 4 }}>{recall.note}</p>
          </Card>
        )}
        <BigButton onClick={() => setStep(2)} disabled={!recall}>다음</BigButton>
        <BigButton variant="ghost" onClick={() => setStep(0)}>뒤로</BigButton>
      </>)}

      {step === 2 && (<>
        <Title sub="응급 상황에 바로 연락할 수 있어요 (건너뛰어도 돼요)">다니시는 치과가 있나요?</Title>
        <Field label="치과 이름" value={clinicName} onChange={setClinicName} placeholder="예) 튼튼치과" />
        <Field label="치과 전화번호" value={clinicPhone} onChange={setClinicPhone} inputMode="tel" placeholder="예) 02-123-4567" />
        <BigButton onClick={() => setStep(3)}>다음</BigButton>
        <BigButton variant="ghost" onClick={() => setStep(1)}>뒤로</BigButton>
      </>)}

      {step === 3 && (<>
        <Title sub="눌러서 바꿀 수 있어요. 시작 후 설정에서 알림을 허용해주세요.">하루 5번 관리 시간</Title>
        {DEFAULT_ROUTINES.map((r, i) => (
          <Card key={r.slot} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
            <span style={{ fontWeight: 700 }}>{r.label}</span>
            <input
              type="time"
              aria-label={`${r.label} 관리 시간`}
              value={times[i]}
              onChange={(e) => setTimes(times.map((t, j) => (j === i ? e.target.value : t)))}
              style={{ font: 'inherit', minWidth: 0, maxWidth: '100%', minHeight: 48, padding: 8, border: '2px solid var(--border)', borderRadius: 10 }}
            />
          </Card>
        ))}
        <BigButton onClick={() => setStep(4)} disabled={!times.every(isValidTime)}>다음</BigButton>
        <BigButton variant="ghost" onClick={() => setStep(2)}>뒤로</BigButton>
      </>)}

      {step === 4 && (<>
        <Title sub="가족이 이 코드를 입력하면 관리 현황을 함께 볼 수 있어요">가족 초대코드</Title>
        <Card style={{ textAlign: 'center', background: 'var(--primary-light)' }}>
          <p style={{ fontSize: 36, fontWeight: 800, letterSpacing: 6, color: 'var(--primary)' }}>
            {profile?.invite_code ?? '------'}
          </p>
          <p style={{ color: 'var(--text-sub)', marginTop: 8 }}>나중에 설정에서 다시 볼 수 있어요</p>
        </Card>
        <ErrorBox message={error} />
        <BigButton onClick={save} disabled={busy}>{busy ? '저장 중...' : '시작하기! 🎉'}</BigButton>
        <BigButton variant="ghost" disabled={busy} onClick={() => setStep(3)}>뒤로</BigButton>
      </>)}
      </div>
    </Screen>
  );
}
