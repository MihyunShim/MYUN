import { useState } from 'react';
import { db, friendlyError } from '../lib/db';
import { useAuth } from '../state/AuthContext';
import { DEFAULT_ROUTINES } from '../lib/types';
import { calculateRecall } from '../lib/recall';
import { Screen, Title, Card, BigButton, Field, ErrorBox } from '../components/ui';

// A1 온보딩 5단계 (docs/설계/01 A1-0)
// ① 이름·출생연도 → ② 틀니 제작 시기 → ③ 치과 정보 → ④ 알림 시간 → ⑤ 초대코드
export default function Onboarding() {
  const { session, profile, refresh } = useAuth();
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState(profile?.name ?? '');
  const [birthYear, setBirthYear] = useState('');
  const [madeYear, setMadeYear] = useState('');
  const [madeMonth, setMadeMonth] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [clinicPhone, setClinicPhone] = useState('');
  const [times, setTimes] = useState(DEFAULT_ROUTINES.map((r) => r.time));

  const recall = calculateRecall(parseInt(madeYear), parseInt(madeMonth));
  const totalSteps = 5;

  const save = async () => {
    if (!session) return;
    setError('');
    setBusy(true);
    try {
      const uid = session.user.id;
      const { error: e1 } = await db().from('profiles')
        .update({ name: name.trim(), birth_year: parseInt(birthYear) || null })
        .eq('id', uid);
      if (e1) { setError(friendlyError(e1.message)); return; }

      const { error: e2 } = await db().from('dentures').upsert({
        user_id: uid,
        made_year: parseInt(madeYear),
        made_month: parseInt(madeMonth),
        clinic_name: clinicName.trim() || null,
        clinic_phone: clinicPhone.trim() || null,
      }, { onConflict: 'user_id' });
      if (e2) { setError(friendlyError(e2.message)); return; }

      const rows = DEFAULT_ROUTINES.map((r, i) => ({
        user_id: uid, slot: r.slot, alarm_time: times[i], label: r.label,
      }));
      const { error: e3 } = await db().from('routines')
        .upsert(rows, { onConflict: 'user_id,slot' });
      if (e3) { setError(friendlyError(e3.message)); return; }

      await refresh(); // onboarded = true 가 되어 홈으로 이동
    } finally {
      setBusy(false);
    }
  };

  const StepBar = () => (
    <div style={{ display: 'flex', gap: 6 }}>
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div key={i} style={{
          flex: 1, height: 8, borderRadius: 4,
          background: i <= step ? 'var(--primary)' : 'var(--border)',
        }} />
      ))}
    </div>
  );

  return (
    <Screen>
      <StepBar />

      {step === 0 && (<>
        <Title sub="어떻게 불러드릴까요?">만나서 반가워요!</Title>
        <Field label="이름" value={name} onChange={setName} placeholder="예) 김순자" />
        <Field label="태어난 연도" value={birthYear} onChange={setBirthYear} inputMode="numeric" placeholder="예) 1948" />
        <BigButton onClick={() => setStep(1)} disabled={!name.trim() || birthYear.length !== 4}>다음</BigButton>
      </>)}

      {step === 1 && (<>
        <Title sub="치과 검진 시기를 계산하는 데 꼭 필요해요">틀니를 언제 만드셨나요?</Title>
        <Field label="만든 연도" value={madeYear} onChange={setMadeYear} inputMode="numeric" placeholder="예) 2024" />
        <Field label="만든 월" value={madeMonth} onChange={setMadeMonth} inputMode="numeric" placeholder="예) 3" />
        {recall && (
          <Card style={{ background: 'var(--primary-light)', borderColor: 'var(--primary)' }}>
            <p style={{ fontWeight: 800, color: 'var(--primary)' }}>지금은 「{recall.phase}」예요</p>
            <p style={{ color: 'var(--text-sub)', marginTop: 4 }}>{recall.note}</p>
          </Card>
        )}
        <BigButton onClick={() => setStep(2)} disabled={madeYear.length !== 4 || !madeMonth}>다음</BigButton>
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
        <Title sub="이 시간에 알려드릴게요. 눌러서 바꿀 수 있어요">하루 5번 관리 시간</Title>
        {DEFAULT_ROUTINES.map((r, i) => (
          <Card key={r.slot} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
            <span style={{ fontWeight: 700 }}>{r.label}</span>
            <input
              type="time"
              value={times[i]}
              onChange={(e) => setTimes(times.map((t, j) => (j === i ? e.target.value : t)))}
              style={{ fontSize: 19, padding: 8, border: '2px solid var(--border)', borderRadius: 10 }}
            />
          </Card>
        ))}
        <BigButton onClick={() => setStep(4)}>다음</BigButton>
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
        <BigButton variant="ghost" onClick={() => setStep(3)}>뒤로</BigButton>
      </>)}
    </Screen>
  );
}
