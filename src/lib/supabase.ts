import { createClient } from '@supabase/supabase-js';

// 접속 정보는 .env 파일에서 읽음 (.env.example 참고)
// VITE_SUPABASE_ANON_KEY는 "공개용 열쇠"라 앱에 포함돼도 안전 —
// 실제 보안은 DB의 RLS(행 단위 접근 규칙)가 담당 (db/migrations/001_init.sql)
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url!, anonKey!)
  : null;
