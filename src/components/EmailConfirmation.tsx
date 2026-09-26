import { useEffect, useRef, useState } from 'react';
import { db, friendlyError } from '../lib/db';
import { BigButton, ErrorBox, Screen, Title } from './ui';

export function EmailConfirmation({ initialEmail, justRequested, onLogin }: {
  initialEmail: string; justRequested: boolean; onLogin: (email: string) => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [retryAt, setRetryAt] = useState(() => justRequested ? Date.now() + 60_000 : 0);
  const [now, setNow] = useState(Date.now);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const inFlight = useRef(false);
  const seconds = Math.max(0, Math.ceil((retryAt - now) / 1000));
  useEffect(() => {
    if (!retryAt) return;
    const timer = setInterval(() => {
      const time = Date.now(); setNow(time);
      if (time >= retryAt) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [retryAt]);
  const resend = async () => {
    if (inFlight.current || Date.now() < retryAt) return;
    inFlight.current = true; setBusy(true); setError(''); setMessage('');
    // Throttle attempts, including failures. The server remains authoritative.
    const time = Date.now(); setNow(time); setRetryAt(time + 60_000);
    try {
      const result = await db().auth.resend({ type: 'signup', email: email.trim() });
      if (result.error) throw result.error;
      setMessage('requested');
    } catch (err) { setError(friendlyError(err)); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <Screen>
    <Title sub="메일의 확인 버튼을 누른 뒤 앱으로 돌아와 로그인해주세요.">이메일 인증 안내</Title>
    <p>아직 인증하지 않은 가입 이메일로 재전송을 요청할 수 있어요. 보호자가 초대코드로 시작했다면 이메일 인증은 필요하지 않아요.</p>
    <form onSubmit={(event) => { event.preventDefault(); void resend(); }} style={{ display: 'grid', gap: 16 }} aria-busy={busy}>
      <label style={{ display: 'grid', gap: 8 }}>
        <span>가입한 이메일</span>
        <input required type="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
          value={email} disabled={busy} onChange={(event) => { setEmail(event.target.value); setMessage(''); setError(''); }}
          style={{ width: '100%', minHeight: 52, padding: 12, fontSize: 'inherit', border: '2px solid var(--border)', borderRadius: 12 }} />
      </label>
      <ErrorBox message={error} />
      {message && <p role="status">인증 대기 중인 이메일이면 재전송 요청이 접수됐어요. 실제 수신 여부는 메일함에서 확인해주세요.</p>}
      <button type="submit" disabled={busy || seconds > 0 || !email.trim()}
        style={{ minHeight: 56, padding: 12, fontSize: 'inherit', fontWeight: 700, background: 'var(--primary)', color: '#fff' }}>
        {busy ? '요청 중...' : seconds > 0 ? `${seconds}초 후 다시 요청할 수 있어요` : '인증 메일 다시 요청'}
      </button>
    </form>
    <p>메일이 없다면 주소의 오타와 스팸함을 확인해주세요. 계속 받지 못하면 앱 문의처에 알려주세요. 재전송 요청만으로 인증이 완료되지는 않아요.</p>
    <BigButton variant="ghost" disabled={busy} onClick={() => onLogin(email.trim())}>로그인 화면으로</BigButton>
  </Screen>;
}
