import { SignOutButton } from '../components/SignOutButton';
import { AccountActions, AppInformation } from '../components/AccountActions';
import { Screen, Title, BigButton } from '../components/ui';

export default function AccountScreen({ onBack }: { onBack?: () => void }) {
  return <Screen>
    <Title>계정과 앱 안내</Title>
    {onBack && <BigButton variant="ghost" onClick={onBack}>뒤로</BigButton>}
    <AppInformation />
    <AccountActions />
    <SignOutButton />
  </Screen>;
}
