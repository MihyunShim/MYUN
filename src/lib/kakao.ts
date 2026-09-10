import { db } from './db';

// 카카오 로그인 (Supabase OAuth)
// 가입 화면에서 역할(A1/A2)을 고른 뒤 카카오로 넘어가므로,
// 선택한 역할을 잠시 보관했다가 로그인 완료 후 프로필에 반영한다
const PENDING_ROLE_KEY = 'denturecare:pending-role';

export function rememberPendingRole(role: 'A1' | 'A2'): void {
  try { sessionStorage.setItem(PENDING_ROLE_KEY, JSON.stringify({ role, at: Date.now() })); } catch { /* 저장 불가 */ }
}

export function clearPendingRole(): void {
  try { sessionStorage.removeItem(PENDING_ROLE_KEY); localStorage.removeItem(PENDING_ROLE_KEY); } catch { /* 저장 불가 */ }
}

export async function applyPendingRole(userId: string): Promise<boolean> {
  let pending: { role?: string; at?: number };
  try {
    pending = JSON.parse(sessionStorage.getItem(PENDING_ROLE_KEY) ?? 'null');
  } catch { clearPendingRole(); return false; }
  if (!pending || !['A1', 'A2'].includes(pending.role ?? '') || !pending.at
    || Date.now() - pending.at > 30 * 60 * 1000) {
    clearPendingRole(); return false;
  }
  const [profile, routines, links] = await Promise.all([
    db().from('profiles').select('created_at').eq('id', userId).single(),
    db().from('routines').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    db().from('care_links').select('id', { count: 'exact', head: true }).or(`elder_id.eq.${userId},guardian_id.eq.${userId}`),
  ]);
  if (profile.error || routines.error || links.error) throw profile.error || routines.error || links.error;
  // 가입 선택으로 기존 계정의 역할과 화면을 바꾸지 않는다.
  if (!profile.data || new Date(profile.data.created_at).getTime() < pending.at - 60000
    || routines.count || links.count) { clearPendingRole(); return false; }
  const { error } = await db().from('profiles').update({ role: pending.role }).eq('id', userId).select('id').single();
  if (error) throw error;
  clearPendingRole();
  return true;
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
