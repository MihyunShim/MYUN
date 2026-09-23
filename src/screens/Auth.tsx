import { useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { db, friendlyError } from '../lib/db';
import { kakaoLogin, rememberPendingRole, clearPendingRole } from '../lib/kakao';
import { Screen, Title, BigButton, ErrorBox } from '../components/ui';
import { AppInformation } from '../components/AccountActions';

type Mode = 'welcome' | 'guardian' | 'signup' | 'login';

// 회원가입/로그인 (docs/설계/01 A1-0, A2-0 진입부)
export default function Auth() {
  const [mode, setMode] = useState<Mode>('welcome');
  const [guardianEntry, setGuardianEntry] = useState(false);
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
        <p>틀니를 직접 사용하시나요? 관리 기록을 시작해요.</p>
        <BigButton onClick={() => { setGuardianEntry(false); setRole('A1'); navigate('signup'); }}>틀니 사용자로 회원가입</BigButton>
        <BigButton variant="ghost" onClick={() => navigate('login')}>이미 계정이 있어요 (로그인)</BigButton>
        <p>초대받은 가족은 이메일 가입 없이 연결해요.</p>
        <BigButton onClick={() => { setGuardianEntry(true); setRole('A2'); navigate('guardian'); }}>가족 초대코드가 있어요</BigButton>
        <AppInformation />
      </Screen>
    );
  }

  if (mode === 'guardian') return <Screen>
    <Title sub="이메일·비밀번호 없이 시작해요.">초대받은 가족·보호자</Title>
    <p>① 내 이름 입력 → ② 초대코드로 연결 요청 → ③ 사용자 승인 후 현황 확인</p>
    <AuthInput label="보호자 이름" name="guardian-name" autoComplete="name" value={name} onChange={setName} disabled={busy} placeholder="사용자가 알아볼 수 있는 내 이름" />
    <p>이 기기에 연결 정보가 저장돼요. 로그아웃하거나 앱 데이터를 지우거나 휴대폰을 바꾸면 다시 초대받아야 해요.</p>
    <ErrorBox message={error} />
    <BigButton disabled={busy || !name.trim()} onClick={async () => {
      if (submitting.current) return;
      submitting.current = true; setBusy(true); setError('');
      try {
        clearPendingRole();
        const result = await db().auth.signInAnonymously({ options: { data: { role: 'A2', name: name.trim() } } });
        if (result.error) throw result.error;
      } catch (err) { setError(friendlyError(err)); }
      finally { submitting.current = false; setBusy(false); }
    }}>{busy ? '준비 중...' : '가입 없이 초대코드 입력하기'}</BigButton>
    <BigButton variant="ghost" onClick={() => navigate('login')}>보호자 계정으로 로그인하기</BigButton>
    <p>연결 후 오늘의 관리 완료 현황, 지난 7일 리포트, 다음 검진일과 도움 요청을 볼 수 있어요. 관리 기록을 대신 수정할 수는 없어요.</p>
    <BigButton variant="ghost" onClick={() => { setGuardianEntry(false); navigate('welcome'); }}>뒤로</BigButton>
  </Screen>;

  return (
    <Screen>
      <Title>{guardianEntry ? (mode === 'signup' ? '보호자 회원가입' : '보호자 로그인') : mode === 'signup' ? '틀니 사용자 회원가입' : '로그인'}</Title>
      {(guardianEntry || (mode === 'signup' && role === 'A2')) && <p>보호자 본인의 이메일을 사용해주세요. 가입·로그인을 마치면 초대코드 입력 화면이 열려요. 이미 연결했다면 가족 현황으로 이동해요.</p>}
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
      <BigButton variant="ghost" disabled={busy} onClick={() => navigate(guardianEntry ? 'guardian' : 'welcome')}>뒤로</BigButton>
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
