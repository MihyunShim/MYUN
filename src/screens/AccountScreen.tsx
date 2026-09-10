import { AccountActions, AppInformation } from '../components/AccountActions';
import { Screen, Title, BigButton } from '../components/ui';
import { useAuth } from '../state/AuthContext';

export default function AccountScreen({ onBack }: { onBack?: () => void }) {
  const { signOut } = useAuth();
  return <Screen>
    <Title>계정과 앱 안내</Title>
    {onBack && <BigButton variant="ghost" onClick={onBack}>뒤로</BigButton>}
    <AppInformation />
    <AccountActions />
    <BigButton variant="ghost" onClick={signOut}>로그아웃</BigButton>
  </Screen>;
}
