import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { db } from '../lib/db';
import type { Profile } from '../lib/types';

// 앱 전체에서 "지금 누가 로그인해 있는가"를 공유하는 저장소
interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  onboarded: boolean; // 루틴 설정 완료 여부
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [onboarded, setOnboarded] = useState(false);

  const loadUserData = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      setOnboarded(false);
      return;
    }
    const { data: p } = await db().from('profiles').select('*').eq('id', s.user.id).single();
    setProfile((p as Profile) ?? null);
    const { count } = await db()
      .from('routines')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', s.user.id);
    setOnboarded((count ?? 0) > 0);
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
    <AuthContext.Provider value={{ loading, session, profile, onboarded, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서만 사용 가능');
  return ctx;
}
