import { useState } from 'react';
import { db, friendlyError } from '../lib/db';
import { kakaoLogin, rememberPendingRole } from '../lib/kakao';
import { useAuth } from '../state/AuthContext';
import { Screen, Title, Card, BigButton, Field, ErrorBox } from '../components/ui';

type Mode = 'welcome' | 'role' | 'signup' | 'login' | 'resetRequest' | 'updatePassword';

// 회원가입/로그인 (docs/설계/01 A1-0, A2-0 진입부)
export default function Auth({ initialMode = 'welcome' }: { initialMode?: Mode }) {
  const { finishPasswordRecovery } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [role, setRole] = useState<'A1' | 'A2'>('A1');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [needConfirm, setNeedConfirm] = useState(false);
  const [notice, setNotice] = useState('');

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
        if (err) { setError(friendlyError(err)); return; }
        if (!data.session) { setNeedConfirm(true); return; } // 이메일 확인이 켜져 있는 경우
      } else {
        const { error: err } = await db().auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) { setError(friendlyError(err)); return; }
      }
    } finally {
      setBusy(false);
    }
  };

  const requestPasswordReset = async () => {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const { error: err } = await db().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      if (err) { setError(friendlyError(err)); return; }
      setNotice('비밀번호를 바꾸는 링크를 이메일로 보냈어요. 메일함을 확인해주세요.');
    } finally {
      setBusy(false);
    }
  };

  const updatePassword = async () => {
    setError('');
    if (password.length < 6) {
      setError('새 비밀번호는 6자 이상으로 만들어주세요.');
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await db().auth.updateUser({ password });
      if (err) { setError(friendlyError(err)); return; }
      finishPasswordRecovery();
    } finally {
      setBusy(false);
    }
  };

  // 카카오 로그인: 가입 경로면 선택한 역할을 보관해뒀다가 로그인 후 프로필에 반영
  const kakao = async () => {
    setError('');
    if (mode === 'signup') rememberPendingRole(role);
    const msg = await kakaoLogin();
    if (msg) setError(friendlyError(msg));
  };

  const KakaoButton = () => (
    <button onClick={kakao} style={{
      width: '100%', minHeight: 56, fontSize: 19, fontWeight: 700,
      background: '#FEE500', color: '#191919', borderRadius: 12,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    }}>
      💬 카카오로 시작하기
    </button>
  );

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

  if (mode === 'resetRequest') {
    return (
      <Screen style={{ justifyContent: 'center' }}>
        <Title sub="가입할 때 쓴 이메일로 비밀번호 변경 링크를 보내드려요.">
          비밀번호를 잊으셨나요?
        </Title>
        <Field label="이메일" value={email} onChange={setEmail} type="email" inputMode="email" placeholder="예) soonja@naver.com" />
        <ErrorBox message={error} />
        {notice && (
          <Card style={{ background: '#F0FDF4', borderColor: 'var(--success)' }}>
            <p style={{ color: 'var(--success)', fontWeight: 700 }}>✉️ {notice}</p>
          </Card>
        )}
        <BigButton onClick={requestPasswordReset} disabled={busy || !email}>
          {busy ? '보내는 중...' : '변경 링크 받기'}
        </BigButton>
        <BigButton variant="ghost" onClick={() => setMode('login')}>로그인으로 돌아가기</BigButton>
      </Screen>
    );
  }

  if (mode === 'updatePassword') {
    return (
      <Screen style={{ justifyContent: 'center' }}>
        <Title sub="앞으로 로그인할 때 사용할 새 비밀번호를 입력해주세요.">
          새 비밀번호 만들기
        </Title>
        <Field label="새 비밀번호" value={password} onChange={setPassword} type="password" placeholder="6자 이상" />
        <ErrorBox message={error} />
        <BigButton onClick={updatePassword} disabled={busy || !password}>
          {busy ? '바꾸는 중...' : '비밀번호 바꾸기'}
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
      {mode === 'login' && (
        <button onClick={() => { setError(''); setMode('resetRequest'); }} style={{
          alignSelf: 'center', minHeight: 44, padding: '0 12px', background: 'none',
          color: 'var(--primary)', fontSize: 16, fontWeight: 700, textDecoration: 'underline',
        }}>
          비밀번호를 잊으셨나요?
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span style={{ color: 'var(--text-sub)', fontSize: 15 }}>또는</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>
      <KakaoButton />
      <BigButton variant="ghost" onClick={() => setMode(mode === 'signup' ? 'role' : 'welcome')}>뒤로</BigButton>
    </Screen>
  );
}
