import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { db } from '../lib/db';
import type { Profile } from '../lib/types';

// 앱 전체에서 "지금 누가 로그인해 있는가"를 공유하는 저장소
interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  onboarded: boolean; // A1: 루틴 설정 완료 / A2: 어르신 연결 완료
  elderId: string | null; // A2 전용: 연결된 어르신의 id
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [elderId, setElderId] = useState<string | null>(null);

  const loadUserData = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      setOnboarded(false);
      setElderId(null);
      return;
    }
    const { data: p } = await db().from('profiles').select('*').eq('id', s.user.id).single();
    const prof = (p as Profile) ?? null;
    setProfile(prof);

    if (prof?.role === 'A2') {
      // 보호자: 활성 연결이 있으면 온보딩 완료
      const { data: link } = await db()
        .from('care_links')
        .select('elder_id')
        .eq('guardian_id', s.user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      setElderId(link?.elder_id ?? null);
      setOnboarded(!!link);
    } else {
      // 틀니 사용자: 루틴이 설정돼 있으면 온보딩 완료
      const { count } = await db()
        .from('routines')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', s.user.id);
      setElderId(null);
      setOnboarded((count ?? 0) > 0);
    }
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await db().auth.getSession();
    setSession(data.session);
    await loadUserData(data.session);
  }, [loadUserData]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    const { data: sub } = db().auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      await loadUserData(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh, loadUserData]);

  const signOut = useCallback(async () => {
    await db().auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ loading, session, profile, onboarded, elderId, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서만 사용 가능');
  return ctx;
}
