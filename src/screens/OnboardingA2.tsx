import { useRef, useState } from 'react';
import { db, friendlyError } from '../lib/db';
import { useAuth } from '../state/AuthContext';
import { Screen, Title, Card, BigButton, ErrorBox } from '../components/ui';
import AccountScreen from './AccountScreen';

const RELATIONS = ['어머니', '아버지', '배우자', '그 외 가족'];

// A2 연결 온보딩: 초대코드 입력 → 관계 선택 → 연결 (docs/설계/01 A2-0)
export default function OnboardingA2() {
  const { refresh, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const [relation, setRelation] = useState(RELATIONS[0]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [linked, setLinked] = useState(false);
  const inFlight = useRef(false);
  const validCode = /^[A-Z0-9]{6}$/.test(code);

  const link = async () => {
    if (inFlight.current || linked || !validCode) return;
    inFlight.current = true;
    setError('');
    setBusy(true);
    try {
      // DB의 link_with_invite_code 함수가 코드 확인 + 연결 생성을 한 번에 처리
      const { error: err } = await db().rpc('link_with_invite_code', {
        code: code.trim(),
        rel: relation,
      });
      if (err) { setError(friendlyError(err)); return; }
      setLinked(true); // 연결 완료 확인 후 가족 현황으로 이동
    } catch (err) { setError(friendlyError(err)); }
    finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  if (linked) return <Screen><Title>가족과 연결했어요</Title><p role="status">이제 연결된 가족의 관리 기록과 검진일을 확인할 수 있어요.</p><p>도움 요청은 보호자 앱을 열어 확인할 수 있어요. 앱이 닫혀 있을 때의 푸시 알림은 아직 제공하지 않아요.</p><BigButton onClick={refresh}>가족 현황 보기</BigButton></Screen>;

  if (accountOpen) return <AccountScreen onBack={() => setAccountOpen(false)} />;
  return (
    <Screen>
      <Title sub="틀니 사용자 앱의 설정 → 가족 초대코드에서 6자리 코드를 확인해주세요">
        💗 가족과 연결하기
      </Title>

      <p>보호자는 본인의 별도 계정으로 가입해주세요. 코드를 입력하면 사용자 이름, 관리·검진 기록과 도움 요청을 볼 수 있어요. 연결은 양쪽 설정에서 해제할 수 있어요.</p>
      <form onSubmit={(event) => { event.preventDefault(); void link(); }} style={{ display: 'grid', gap: 16 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontWeight: 700 }}>초대코드 (6자리)</span>
        <input
          value={code}
          onChange={(e) => { setCode(e.target.value.replace(/\s/g, '').toUpperCase().slice(0, 6)); setError(''); }}
          disabled={busy}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby="invite-code-hint"
          placeholder="예) 2F87E4"
          style={{
            minHeight: 60, fontSize: 28, fontWeight: 800, letterSpacing: 8,
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

      <ErrorBox message={error} />
      <button type="submit" disabled={busy || !validCode} style={{ minHeight: 56, width: '100%', padding: 12, background: 'var(--primary)', color: '#fff', fontWeight: 700, opacity: busy || !validCode ? 0.5 : 1 }}>{busy ? '연결 중...' : '연결하기'}</button>
      </form>
      <BigButton variant="ghost" disabled={busy} onClick={signOut}>로그아웃</BigButton>
      <BigButton variant="ghost" disabled={busy} onClick={() => setAccountOpen(true)}>계정·앱 안내</BigButton>
    </Screen>
  );
}
