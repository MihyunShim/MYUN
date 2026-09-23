import { useRef, useState } from 'react';
import { AccountActions, AppInformation } from '../components/AccountActions';
import { Screen, Title, BigButton } from '../components/ui';
import { useAuth } from '../state/AuthContext';

export default function AccountScreen({ onBack }: { onBack?: () => void }) {
  const { signOut, session } = useAuth();
  const [busy, setBusy] = useState(false);
  const signingOut = useRef(false);
  const logout = async () => {
    if (signingOut.current) return;
    signingOut.current = true; setBusy(true);
    try { await signOut(); } finally { signingOut.current = false; setBusy(false); }
  };
  return <Screen>
    <Title>계정과 앱 안내</Title>
    {onBack && <BigButton variant="ghost" onClick={onBack}>뒤로</BigButton>}
    <AppInformation />
    <AccountActions />
    {session?.user.is_anonymous && <p>가입 없이 연결한 보호자는 로그아웃 후 새 초대와 사용자 승인이 필요해요.</p>}
    <BigButton variant="ghost" disabled={busy} onClick={logout}>{busy ? '로그아웃 중...' : '로그아웃'}</BigButton>
  </Screen>;
}
