import { CheckConsent, ConsentDetails } from '../components/PrivacyConsent';
import { usePrivacyNotice } from '../lib/privacy';
import { useCallback, useRef, useState } from 'react';
import { db, friendlyError } from '../lib/db';
import { useAuth } from '../state/AuthContext';
import { Screen, Title, Card, BigButton, ErrorBox } from '../components/ui';
import { GuardianRequests } from '../components/GuardianRequests';
import AccountScreen from './AccountScreen';

const RELATIONS = ['어머니', '아버지', '배우자', '그 외 가족'];

// A2 연결 온보딩: 초대코드 입력 → 관계 선택 → 연결 (docs/설계/01 A2-0)
export default function OnboardingA2() {
  const { notice,error:privacyError }=usePrivacyNotice();
  const [share,setShare]=useState(false);
  const { signOut } = useAuth();
  const [code, setCode] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const [relation, setRelation] = useState(RELATIONS[0]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [linked, setLinked] = useState(false);
  const [pending, setPending] = useState(false);
  const [checked, setChecked] = useState(false);
  const onPendingChange = useCallback((value: boolean) => { setPending(value); setChecked(true); if (!value) setLinked(false); }, []);
  const inFlight = useRef(false);
  const validCode = /^[A-Z0-9]{6}$/.test(code);

  const link = async () => {
    if (inFlight.current || pending || !checked || !validCode || !share || !notice) return;
    inFlight.current = true;
    setError('');
    setBusy(true);
    try {
      // Request creation does not grant access. The user must approve separately.
      const { error: err } = await db().rpc('request_guardian_with_consent', {
        code: code.trim(),
        rel: relation, notice_version: notice.version, share,
      });
      if (err) { setError(friendlyError(err)); return; }
      setPending(true); setLinked(true);
    } catch (err) { setError(friendlyError(err)); }
    finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  if (accountOpen) return <AccountScreen onBack={() => setAccountOpen(false)} />;
  return (
    <Screen>
      <Title sub="틀니 사용자 앱의 설정 → 가족 초대코드에서 6자리 코드를 확인해주세요">
        {linked ? '연결 요청을 보냈어요' : pending ? '승인을 기다리고 있어요' : '💗 초대코드로 가족 연결'}
      </Title>

      <p>보호자 준비가 완료됐어요. 아래에 초대코드를 입력하고 ‘연결 요청하기’를 눌러주세요. 사용자가 승인하면 오늘의 관리 현황, 지난 7일 리포트, 다음 검진일과 도움 요청을 볼 수 있어요. 관리 기록을 대신 수정할 수는 없으며, 연결은 양쪽 설정에서 해제할 수 있어요.</p>
      <GuardianRequests reloadKey={linked ? 1 : 0} onPendingChange={onPendingChange} />
      {pending && <p>사용자 앱의 설정 → 보호자 연결 요청에서 승인하면 가족 현황을 볼 수 있어요. 다른 코드로 요청하려면 먼저 현재 요청을 취소해주세요.</p>}
      {checked && !pending && <form onSubmit={(event) => { event.preventDefault(); void link(); }} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', minWidth: 0, gap: 16 }}>
      <label style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 8 }}>
        <span style={{ fontWeight: 700 }}>초대코드 (6자리)</span>
        <input
          value={code}
          onChange={(e) => { setCode(e.target.value.replace(/\s/g, '').toUpperCase().slice(0, 6)); setError(''); setShare(false); }}
          disabled={busy}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby="invite-code-hint"
          placeholder="예) 2F87E4"
          style={{
            width: '100%', minWidth: 0, minHeight: 60, fontSize: 28, fontWeight: 800, letterSpacing: 8,
            textAlign: 'center', border: '2px solid var(--border)', borderRadius: 12,
            background: 'var(--surface)', color: 'var(--text)', textTransform: 'uppercase',
          }}
        />
      </label>

      <p id="invite-code-hint">영문과 숫자 6자리예요. 붙여넣은 공백과 소문자는 자동으로 정리해요.</p>
      <Card>
        <p id="relation-label" style={{ fontWeight: 700, marginBottom: 10 }}>틀니 사용자는 나의 누구인가요?</p>
        <div role="group" aria-labelledby="relation-label" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10 }}>
          {RELATIONS.map((r) => (
            <button key={r} type="button" aria-pressed={relation === r} disabled={busy} onClick={() => setRelation(r)} style={{
              minHeight: 52, fontWeight: 700, borderRadius: 12,
              background: relation === r ? 'var(--primary)' : 'var(--primary-light)',
              color: relation === r ? '#fff' : 'var(--primary)',
            }}>
              {r}
            </button>
          ))}
        </div>
      </Card>

      <ErrorBox message={error || privacyError} />
      {notice && <CheckConsent label="초대코드 사용자에게 내 이름·관계 제공에 동의해요" checked={share} onChange={setShare} disabled={busy}><p>받는 사람: 입력한 초대코드를 발급한 틀니 사용자</p><ConsentDetails detail={notice.document.guardianShare}/></CheckConsent>}
      <button type="submit" disabled={busy || !validCode || !share || !notice} style={{ minHeight: 56, width: '100%', padding: 12, background: 'var(--primary)', color: '#fff', fontWeight: 700, opacity: busy || !validCode ? 0.5 : 1 }}>{busy ? '요청 중...' : '연결 요청하기'}</button>
      </form>}
      <p>가입 없이 시작했다면 로그아웃 후에는 새 초대와 승인이 필요해요.</p>
      <BigButton variant="ghost" disabled={busy} onClick={signOut}>로그아웃</BigButton>
      <BigButton variant="ghost" disabled={busy} onClick={() => setAccountOpen(true)}>계정·앱 안내</BigButton>
    </Screen>
  );
}
