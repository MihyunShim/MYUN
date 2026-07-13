import { supabase } from './supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

// 설정이 안 된 상태에서 화면 코드가 실행되는 것을 방지하는 안전장치
export function db(): SupabaseClient {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다 (.env 확인)');
  return supabase;
}

// Supabase 에러를 고령자 눈높이의 문구로 변환
export function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return '이메일 또는 비밀번호가 맞지 않아요. 다시 확인해주세요.';
  if (m.includes('already') && m.includes('registered')) return '이미 가입된 이메일이에요. 로그인을 눌러주세요.';
  if (m.includes('email_exists') || m.includes('user_already_exists')) return '이미 가입된 이메일이에요. 로그인을 눌러주세요.';
  if (m.includes('rate limit')) return '잠시 요청이 많아요. 1시간 후에 다시 시도해주세요.';
  if (m.includes('email not confirmed')) return '이메일 확인이 아직 안 됐어요. 메일함을 확인해주세요.';
  if (m.includes('password should be at least')) return '비밀번호는 6자 이상으로 만들어주세요.';
  if (m.includes('valid email')) return '이메일 주소를 다시 확인해주세요.';
  if (m.includes('fetch') || m.includes('network')) return '인터넷 연결을 확인해주세요.';
  if (m.includes('invalid_code')) return '코드를 다시 확인해주세요. 부모님 앱의 설정에서 볼 수 있어요.';
  return '문제가 생겼어요. 잠시 후 다시 시도해주세요.';
}
