import { ConnectionStatus } from './components/ConnectionStatus';
import { useEffect } from 'react';
import { isSupabaseConfigured } from './lib/supabase';
import { AuthProvider, useAuth } from './state/AuthContext';
import Auth from './screens/Auth';
import { useRefreshOnResume } from './lib/useRefreshOnResume';
import PrivacyGate from './screens/PrivacyGate';
import Onboarding from './screens/Onboarding';
import OnboardingA2 from './screens/OnboardingA2';
import A1Shell from './screens/A1Shell';
import A2Shell from './screens/A2Shell';
import { Screen, Title, Splash, ErrorBox, BigButton } from './components/ui';

// 화면 라우팅: 로그인 여부 → 역할 → 온보딩 여부에 따라 보여줄 화면 결정 (docs/설계/01 흐름도)
function Router() {
  const { loading, error, session, profile, onboarded, privacyReady, refresh, signOut } = useAuth();

  useRefreshOnResume(refresh);
  // 설정의 글자 크기를 앱 전체에 반영 (고령자 접근성)
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--font-body',
      profile?.font_size_mode === 'large' ? '22px' : '18px',
    );
  }, [profile?.font_size_mode]);

  if (loading) return <Splash text="저장된 정보를 불러오는 중..." />;
  if (error) return <Screen><Title>정보를 불러오지 못했어요</Title><ErrorBox message={error} /><BigButton onClick={refresh}>다시 시도</BigButton>{session && <BigButton variant="ghost" onClick={signOut}>로그아웃</BigButton>}</Screen>;
  if (!session) return <Auth />;
  if (!profile) return <Splash text="프로필을 준비하는 중..." />;

  if (!privacyReady) return <PrivacyGate />;

  if (profile.role === 'A1') {
    return onboarded ? <A1Shell /> : <Onboarding />;
  }
  return onboarded ? <A2Shell /> : <OnboardingA2 />;
}

export default function App() {
  if (!isSupabaseConfigured) {
    return (
      <Screen style={{ justifyContent: 'center' }}>
        <Title sub="앱 연결 설정을 확인해야 해요. 설치를 도와주신 분에게 문의해주세요.">
          앱을 준비하고 있어요
        </Title>
      </Screen>
    );
  }
  return (
    <AuthProvider>
      <ConnectionStatus />
      <Router />
    </AuthProvider>
  );
}
