import { useState } from 'react';
import { db, friendlyError } from '../lib/db';
import { useAuth } from '../state/AuthContext';
import { Screen, Title, Card, BigButton, ErrorBox } from '../components/ui';

const RELATIONS = ['어머니', '아버지', '배우자', '그 외 가족'];

// A2 연결 온보딩: 초대코드 입력 → 관계 선택 → 연결 (docs/설계/01 A2-0)
export default function OnboardingA2() {
  const { refresh, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [relation, setRelation] = useState(RELATIONS[0]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const link = async () => {
    setError('');
    setBusy(true);
    try {
      // DB의 link_with_invite_code 함수가 코드 확인 + 연결 생성을 한 번에 처리
      const { error: err } = await db().rpc('link_with_invite_code', {
        code: code.trim(),
        rel: relation,
      });
      if (err) { setError(friendlyError(err.message)); return; }
      await refresh(); // 연결 완료 → 보호자 홈으로
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Title sub="부모님 앱의 온보딩 마지막 화면(또는 설정)에 있는 6자리 코드를 입력해주세요">
        💗 가족과 연결하기
      </Title>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontWeight: 700 }}>초대코드 (6자리)</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          placeholder="예) 2F87E4"
          style={{
            minHeight: 60, fontSize: 28, fontWeight: 800, letterSpacing: 8,
            textAlign: 'center', border: '2px solid var(--border)', borderRadius: 12,
            background: 'var(--surface)', color: 'var(--text)', textTransform: 'uppercase',
          }}
        />
      </label>

      <Card>
        <p style={{ fontWeight: 700, marginBottom: 10 }}>어떤 관계이신가요?</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {RELATIONS.map((r) => (
            <button key={r} onClick={() => setRelation(r)} style={{
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
      <BigButton onClick={link} disabled={busy || code.trim().length !== 6}>
        {busy ? '연결 중...' : '연결하기'}
      </BigButton>
      <BigButton variant="ghost" onClick={signOut}>로그아웃</BigButton>
    </Screen>
  );
}
