import { useId, useRef, useState } from 'react';
import { useAuth } from '../state/AuthContext';
import { friendlyError } from '../lib/db';
import { BigButton, ErrorBox, Modal } from './ui';

export function SignOutButton({ compact = false, disabled = false }: { compact?: boolean; disabled?: boolean }) {
  const { session, signOut } = useAuth();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const running = useRef(false);
  const heading = useId();
  const logout = async () => {
    if (running.current) return;
    running.current = true; setBusy(true); setError('');
    try { await signOut(); setConfirm(false); }
    catch (err) { setError(friendlyError(err)); }
    finally { running.current = false; setBusy(false); }
  };
  const start = () => {
    if (session?.user.is_anonymous) setConfirm(true);
    else void logout();
  };
  return <>
    {compact ? <button type="button" disabled={disabled || busy} onClick={start}
      style={{ background: 'none', color: 'var(--text-sub)', fontSize: 'max(16px, 0.9em)', whiteSpace: 'nowrap', flexShrink: 0, textDecoration: 'underline', minHeight: 48 }}>
      {busy ? '로그아웃 중...' : '로그아웃'}
    </button> : <BigButton variant="ghost" disabled={disabled || busy} onClick={start}>{busy ? '로그아웃 중...' : '로그아웃'}</BigButton>}
    {!confirm && <ErrorBox message={error} />}
    {confirm && <Modal labelledBy={heading} onClose={() => { if (!busy) setConfirm(false); }}>
      <h2 id={heading}>보호자 연결을 나갈까요?</h2>
      <p>이메일 없이 시작한 임시 계정이에요. 로그아웃하면 이 계정으로 다시 로그인할 수 없고, 새 초대코드와 사용자 승인이 필요해요.</p>
      <p>로그아웃만으로 서버의 계정이나 가족 연결이 삭제되지는 않아요. 삭제하려면 설정의 ‘회원 탈퇴’를 이용해주세요.</p>
      <ErrorBox message={error} />
      <BigButton variant="ghost" disabled={busy} onClick={() => setConfirm(false)}>계속 이용하기</BigButton>
      <BigButton variant="danger" disabled={busy} onClick={() => void logout()}>{busy ? '로그아웃 중...' : '알겠어요, 로그아웃'}</BigButton>
    </Modal>}
  </>;
}
