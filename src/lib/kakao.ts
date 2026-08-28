import { db } from './db';

// 카카오 로그인 (Supabase OAuth)
// 가입 화면에서 역할(A1/A2)을 고른 뒤 카카오로 넘어가므로,
// 선택한 역할을 잠시 보관했다가 로그인 완료 후 프로필에 반영한다
const PENDING_ROLE_KEY = 'denturecare:pending-role';

export function rememberPendingRole(role: 'A1' | 'A2'): void {
  try { localStorage.setItem(PENDING_ROLE_KEY, role); } catch { /* 저장 불가 환경은 무시 */ }
}

export async function applyPendingRole(userId: string): Promise<boolean> {
  try {
    const role = localStorage.getItem(PENDING_ROLE_KEY);
    if (role !== 'A1' && role !== 'A2') return false;
    localStorage.removeItem(PENDING_ROLE_KEY);
    const { error } = await db().from('profiles').update({ role }).eq('id', userId);
    return !error;
  } catch {
    return false;
  }
}

export async function kakaoLogin(): Promise<string | null> {
  // 바로 이동하지 않고 주소만 받아서, 설정이 안 된 경우를 먼저 감지한다
  const { data, error } = await db().auth.signInWithOAuth({
    provider: 'kakao',
    options: { redirectTo: window.location.origin, skipBrowserRedirect: true },
  });
  if (error) return error.message;
  if (!data?.url) return 'provider is not enabled';

  try {
    // 정상이면 카카오로 넘겨주는 응답(redirect), 미설정이면 400 오류가 온다
    const res = await fetch(data.url, { redirect: 'manual' });
    if (res.status === 400) return 'provider is not enabled';
  } catch { /* 확인 불가 환경이면 그대로 진행 */ }

  window.location.assign(data.url); // 카카오 로그인 페이지로 이동
  return null;
}
