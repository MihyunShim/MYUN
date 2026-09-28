import { createClient } from '@supabase/supabase-js';
import { createBoundedFetch } from './boundedFetch';
import type { PrivacyNotice } from './privacy';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
// This page must remain readable even when a saved account session has expired.
// It never reads local auth storage, refreshes tokens, or queries private tables.
const publicClient = url && key ? createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: createBoundedFetch((...args) => fetch(...args)) },
}) : null;

export async function getPublicPrivacyNotice(signal: AbortSignal): Promise<PrivacyNotice | null> {
  if (!publicClient) throw new Error('PUBLIC_NOTICE_NOT_CONFIGURED');
  const { data, error } = await publicClient.rpc('get_privacy_notice').abortSignal(signal);
  if (error) throw error;
  return data;
}
