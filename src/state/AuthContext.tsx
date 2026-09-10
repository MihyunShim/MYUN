import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { db, friendlyError } from '../lib/db';
import { applyPendingRole } from '../lib/kakao';
import { cancelRoutineNotifications, setNotificationOwner } from '../lib/notifications';
import type { Profile } from '../lib/types';

interface AuthState {
  loading: boolean;
  error: string;
  session: Session | null;
  profile: Profile | null;
  onboarded: boolean;
  elderId: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [elderId, setElderId] = useState<string | null>(null);
  const generation = useRef(0);
  const currentSession = useRef<Session | null>(null);

  const loadUserData = useCallback(async (s: Session | null) => {
    const request = ++generation.current;
    setLoading(true);
    setError('');
    try {
      if (!s) {
        setNotificationOwner(null);
        await cancelRoutineNotifications();
        if (request !== generation.current) return;
        setProfile(null);
        setOnboarded(false);
        setElderId(null);
        return;
      }
      if (s.user.app_metadata.provider === 'kakao') await applyPendingRole(s.user.id);
      const p = await db().from('profiles').select('*').eq('id', s.user.id).single();
      if (p.error) throw p.error;
      if (!p.data) throw new Error('PROFILE_MISSING');
      const prof = p.data as Profile;
      let linkedElder: string | null = null;
      let ready = false;
      if (prof.role === 'A2') {
        const link = await db().from('care_links').select('elder_id')
          .eq('guardian_id', s.user.id).eq('status', 'active')
          .order('linked_at', { ascending: false }).limit(1).maybeSingle();
        if (link.error) throw link.error;
        linkedElder = link.data?.elder_id ?? null;
        ready = !!linkedElder;
      } else {
        const routines = await db().from('routines').select('id', { count: 'exact', head: true })
          .eq('user_id', s.user.id);
        if (routines.error) throw routines.error;
        ready = (routines.count ?? 0) > 0;
      }
      // 느린 이전 계정의 응답이 새 계정 화면을 덮지 못하도록 한다.
      if (request !== generation.current) return;
      if (prof.role === 'A2') await cancelRoutineNotifications();
      if (request !== generation.current) return;
      setNotificationOwner(prof.role === 'A1' ? s.user.id : null);
      setProfile(prof);
      setElderId(linkedElder);
      setOnboarded(ready);
    } catch (err) {
      if (request === generation.current) setError(friendlyError(err));
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await loadUserData(currentSession.current);
  }, [loadUserData]);

  useEffect(() => {
    const { data } = db().auth.onAuthStateChange((_event, next) => {
      if (currentSession.current?.user.id !== next?.user.id) {
        setNotificationOwner(null);
        generation.current += 1;
        setProfile(null);
        setOnboarded(false);
        setElderId(null);
        setLoading(true);
      }
      currentSession.current = next;
      setSession(next);
      setInitialized(true);
      // 인증 콜백 안에서는 Supabase 요청을 기다리지 않는다.
    });
    return () => { generation.current += 1; data.subscription.unsubscribe(); };
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (initialized) void loadUserData(currentSession.current);
  }, [initialized, userId, loadUserData]);

  const signOut = useCallback(async () => {
    generation.current += 1;
    setNotificationOwner(null);
    try {
      // 알림 정리가 실패해도 계정 로그아웃은 시도한다. 실패는 재시도 화면에 표시한다.
      let notificationError: unknown;
      try { await cancelRoutineNotifications(); } catch (err) { notificationError = err; }
      const result = await db().auth.signOut({ scope: 'local' });
      if (result.error) throw result.error;
      if (notificationError) throw notificationError;
    } catch (err) {
      setError(friendlyError(err));
      setLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ loading, error, session, profile, onboarded, elderId, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서만 사용 가능');
  return ctx;
}
