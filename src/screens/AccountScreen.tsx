import { useRef, useState } from 'react';
import { AccountActions, AppInformation } from '../components/AccountActions';
import { Screen, Title, BigButton } from '../components/ui';
import { useAuth } from '../state/AuthContext';

export default function AccountScreen({ onBack }: { onBack?: () => void }) {
  const { signOut } = useAuth();
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
    <BigButton variant="ghost" disabled={busy} onClick={logout}>{busy ? '로그아웃 중...' : '로그아웃'}</BigButton>
  </Screen>;
}
