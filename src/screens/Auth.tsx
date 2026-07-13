import { useState } from 'react';
import { db, friendlyError } from '../lib/db';
import { Screen, Title, Card, BigButton, Field, ErrorBox } from '../components/ui';

type Mode = 'welcome' | 'role' | 'signup' | 'login';

// 회원가입/로그인 (docs/설계/01 A1-0, A2-0 진입부)
export default function Auth() {
  const [mode, setMode] = useState<Mode>('welcome');
  const [role, setRole] = useState<'A1' | 'A2'>('A1');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [needConfirm, setNeedConfirm] = useState(false);

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      if (mode === 'signup') {
        if (!name.trim()) { setError('이름을 입력해주세요.'); return; }
        const { data, error: err } = await db().auth.signUp({
          email: email.trim(),
          password,
          options: { data: { role, name: name.trim() } },
        });
        if (err) { setError(friendlyError(err.message)); return; }
        if (!data.session) { setNeedConfirm(true); return; } // 이메일 확인이 켜져 있는 경우
      } else {
        const { error: err } = await db().auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) { setError(friendlyError(err.message)); return; }
      }
    } finally {
      setBusy(false);
    }
  };

  if (needConfirm) {
    return (
      <Screen style={{ justifyContent: 'center' }}>
        <Title sub="메일함에서 확인 버튼을 누른 뒤, 앱으로 돌아와 로그인해주세요.">
          📮 이메일을 확인해주세요
        </Title>
        <BigButton onClick={() => { setNeedConfirm(false); setMode('login'); }}>
          로그인 화면으로
        </BigButton>
      </Screen>
    );
  }

  if (mode === 'welcome') {
    return (
      <Screen style={{ justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', fontSize: 56 }}>🦷</div>
        <Title sub="틀니 관리, 이제 앱이 챙겨드려요">틀니케어</Title>
        <BigButton onClick={() => setMode('role')}>처음이에요 (회원가입)</BigButton>
        <BigButton variant="ghost" onClick={() => setMode('login')}>이미 계정이 있어요 (로그인)</BigButton>
      </Screen>
    );
  }

  if (mode === 'role') {
    return (
      <Screen>
        <Title sub="맞는 것을 하나 골라주세요">어떻게 사용하시나요?</Title>
        <Card style={{ cursor: 'pointer', borderColor: role === 'A1' ? 'var(--primary)' : 'var(--border)', borderWidth: 2 }}>
          <div onClick={() => setRole('A1')}>
            <p style={{ fontWeight: 800, fontSize: 20 }}>🙋 제가 직접 사용해요</p>
            <p style={{ color: 'var(--text-sub)' }}>틀니를 사용하시는 본인</p>
          </div>
        </Card>
        <Card style={{ cursor: 'pointer', borderColor: role === 'A2' ? 'var(--primary)' : 'var(--border)', borderWidth: 2 }}>
          <div onClick={() => setRole('A2')}>
            <p style={{ fontWeight: 800, fontSize: 20 }}>💗 가족을 도와드려요</p>
            <p style={{ color: 'var(--text-sub)' }}>자녀·배우자 등 보호자</p>
          </div>
        </Card>
        <BigButton onClick={() => setMode('signup')}>다음</BigButton>
        <BigButton variant="ghost" onClick={() => setMode('welcome')}>뒤로</BigButton>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>{mode === 'signup' ? '회원가입' : '로그인'}</Title>
      {mode === 'signup' && (
        <Field label="이름" value={name} onChange={setName} placeholder="예) 김순자" />
      )}
      <Field label="이메일" value={email} onChange={setEmail} type="email" inputMode="email" placeholder="예) soonja@naver.com" />
      <Field label="비밀번호" value={password} onChange={setPassword} type="password" placeholder="6자 이상" />
      <ErrorBox message={error} />
      <BigButton onClick={submit} disabled={busy || !email || !password}>
        {busy ? '잠시만요...' : mode === 'signup' ? '가입하기' : '로그인'}
      </BigButton>
      <BigButton variant="ghost" onClick={() => setMode(mode === 'signup' ? 'role' : 'welcome')}>뒤로</BigButton>
    </Screen>
  );
}
