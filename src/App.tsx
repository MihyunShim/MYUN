import { isSupabaseConfigured } from './lib/supabase';
import { AuthProvider, useAuth } from './state/AuthContext';
import Auth from './screens/Auth';
import Onboarding from './screens/Onboarding';
import HomeA1 from './screens/HomeA1';
import { Screen, Title, Splash, BigButton } from './components/ui';

// 화면 라우팅: 로그인 여부 → 역할 → 온보딩 여부에 따라 보여줄 화면 결정 (docs/설계/01 흐름도)
function Router() {
  const { loading, session, profile, onboarded, signOut } = useAuth();

  if (loading) return <Splash text="저장된 정보를 불러오는 중..." />;
  if (!session) return <Auth />;
  if (!profile) return <Splash text="프로필을 준비하는 중..." />;

  if (profile.role === 'A1') {
    return onboarded ? <HomeA1 /> : <Onboarding />;
  }

  // A2 보호자 화면은 Phase 3에서 구현 (docs/설계/01 A2-0~A2-4)
  return (
    <Screen style={{ justifyContent: 'center' }}>
      <Title sub="보호자 연동 기능을 열심히 만들고 있어요. 조금만 기다려주세요!">
        💗 보호자 화면 준비 중
      </Title>
      <BigButton variant="ghost" onClick={signOut}>로그아웃</BigButton>
    </Screen>
  );
}

export default function App() {
  if (!isSupabaseConfigured) {
    return (
      <Screen style={{ justifyContent: 'center' }}>
        <Title sub=".env 파일에 서버 접속 정보를 채워주세요 (.env.example 참고)">
          ⚙️ 서버 설정이 필요해요
        </Title>
      </Screen>
    );
  }
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}
