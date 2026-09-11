import { useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { db, friendlyError } from '../lib/db';
import { kakaoLogin, rememberPendingRole, clearPendingRole } from '../lib/kakao';
import { Screen, Title, BigButton, ErrorBox } from '../components/ui';
import { AppInformation } from '../components/AccountActions';

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
  const [showPassword, setShowPassword] = useState(false);
  const submitting = useRef(false);
  const navigate = (next: Mode) => { setError(''); setShowPassword(false); setPassword(''); setMode(next); };

  const submit = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setError('');
    setBusy(true);
    try {
      clearPendingRole();
      if (mode === 'signup') {
        if (!name.trim()) { setError('이름을 입력해주세요.'); return; }
        if (password.length < 6) { setError('비밀번호는 6자 이상으로 만들어주세요.'); return; }
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
    } catch (err) { setError(friendlyError(err)); }
    finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  // 카카오 로그인: 가입 경로면 선택한 역할을 보관해뒀다가 로그인 후 프로필에 반영
  const kakao = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      if (mode === 'signup') rememberPendingRole(role);
      else clearPendingRole();
      const msg = await kakaoLogin();
      if (msg) { clearPendingRole(); setError(friendlyError(msg)); }
    } catch (err) { clearPendingRole(); setError(friendlyError(err)); }
    finally { submitting.current = false; setBusy(false); }
  };

  const KakaoButton = () => (
    <button type="button" disabled={busy} onClick={kakao} style={{
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
        <BigButton onClick={() => { setNeedConfirm(false); navigate('login'); }}>
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
        <BigButton onClick={() => navigate('role')}>처음이에요 (회원가입)</BigButton>
        <BigButton variant="ghost" onClick={() => navigate('login')}>이미 계정이 있어요 (로그인)</BigButton>
        <AppInformation />
      </Screen>
    );
  }

  if (mode === 'role') {
    return (
      <Screen>
        <Title sub="맞는 것을 하나 골라주세요">어떻게 사용하시나요?</Title>
        <fieldset style={{ border: 0, padding: 0, display: 'grid', gap: 16 }}>
          <legend style={{ marginBottom: 12 }}>사용자 선택</legend>
          {([{ value: 'A1', title: '🙋 제가 직접 사용해요', description: '틀니를 사용하시는 본인' },
            { value: 'A2', title: '💗 가족을 도와드려요', description: '자녀·배우자 등 보호자' }] as const).map((option) => (
            <label key={option.value} style={{ padding: 20, borderRadius: 16, border: `2px solid ${role === option.value ? 'var(--primary)' : 'var(--border)'}`, background: 'var(--surface)', cursor: 'pointer' }}>
              <input type="radio" name="role" value={option.value} checked={role === option.value} onChange={() => setRole(option.value)} />
              <span style={{ fontWeight: 800, marginLeft: 8 }}>{option.title}</span>
              <p style={{ color: 'var(--text-sub)', marginTop: 8 }}>{option.description}</p>
            </label>
          ))}
        </fieldset>
        <BigButton onClick={() => navigate('signup')}>다음</BigButton>
        <BigButton variant="ghost" onClick={() => navigate('welcome')}>뒤로</BigButton>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>{mode === 'signup' ? '회원가입' : '로그인'}</Title>
      <form onSubmit={(event) => { event.preventDefault(); void submit(); }} aria-busy={busy} style={{ display: 'grid', gap: 16 }}>
        {mode === 'signup' && <AuthInput label="이름" name="name" autoComplete="name" value={name} onChange={setName} disabled={busy} placeholder="예) 김순자" />}
        <AuthInput label="이메일" name="email" type="email" autoComplete="username" value={email} onChange={setEmail} disabled={busy} placeholder="예) soonja@naver.com" />
        <AuthInput label="비밀번호" name="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={setPassword} disabled={busy} placeholder={mode === 'signup' ? '6자 이상' : '가입할 때 정한 비밀번호'} />
        <button type="button" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)} style={{ minHeight: 48, color: 'var(--primary)', background: 'var(--primary-light)', fontSize: 'inherit' }}>
          {showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
        </button>
        <ErrorBox message={error} />
        <button type="submit" disabled={busy || !email.trim() || !password} style={{ minHeight: 56, fontSize: 19, fontWeight: 700, color: '#fff', background: 'var(--primary)' }}>
          {busy ? '잠시만요...' : mode === 'signup' ? '가입하기' : '로그인'}
        </button>
      </form>
      {!Capacitor.isNativePlatform() && <><div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span style={{ color: 'var(--text-sub)', fontSize: 15 }}>또는</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>
      <KakaoButton /></>}
      <BigButton variant="ghost" disabled={busy} onClick={() => navigate(mode === 'signup' ? 'role' : 'welcome')}>뒤로</BigButton>
    </Screen>
  );
}

function AuthInput({ label, name, type = 'text', autoComplete, value, onChange, disabled, placeholder }: {
  label: string; name: string; type?: string; autoComplete: string; value: string;
  onChange: (value: string) => void; disabled: boolean; placeholder: string;
}) {
  return <label style={{ display: 'grid', gap: 8, minWidth: 0 }}>
    <span style={{ fontWeight: 700 }}>{label}</span>
    <input required name={name} type={type} autoComplete={autoComplete} autoCapitalize="none" spellCheck={false}
      inputMode={type === 'email' ? 'email' : 'text'} value={value} disabled={disabled} placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      style={{ width: '100%', minHeight: 52, fontSize: 19, padding: '0 16px', border: '2px solid var(--border)', borderRadius: 12, background: 'var(--surface)', color: 'var(--text)' }} />
  </label>;
}
