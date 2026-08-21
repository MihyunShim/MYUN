import { supabase } from './supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

// 설정이 안 된 상태에서 화면 코드가 실행되는 것을 방지하는 안전장치
export function db(): SupabaseClient {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다 (.env 확인)');
  return supabase;
}

// 에러 객체에서 판단에 쓸 정보를 문자열 하나로 모은다
// (네트워크 오류는 message가 비어 있고 name에만 단서가 있는 경우가 있음)
function errorSignature(err: unknown): string {
  if (typeof err === 'string') return err.toLowerCase();
  if (err && typeof err === 'object') {
    const e = err as { message?: string; name?: string; code?: string; status?: number };
    return [e.message, e.name, e.code, e.status].filter(Boolean).join(' ').toLowerCase();
  }
  return String(err ?? '').toLowerCase();
}

// Supabase 에러를 고령자 눈높이의 문구로 변환
// 문자열(err.message)과 에러 객체 둘 다 받을 수 있다
export function friendlyError(err: unknown): string {
  const m = errorSignature(err);

  // 서버에 아예 닿지 못한 경우 (연결 실패 · 서버 일시정지 · 인터넷 끊김)
  // Supabase 무료 플랜은 7일 미사용 시 프로젝트가 자동 일시정지되어 주소 자체가 사라진다
  if (
    m.includes('fetch') || m.includes('network') || m.includes('load failed') ||
    m.includes('econnrefused') || m.includes('enotfound') || m.includes('dns') ||
    m.includes('typeerror') || m.includes('status 0') || m.includes('aborted')
  ) {
    return '서버에 연결할 수 없어요. 인터넷 연결을 확인하시거나, 잠시 후 다시 시도해주세요.';
  }

  if (m.includes('invalid login credentials')) return '이메일 또는 비밀번호가 맞지 않아요. 다시 확인해주세요.';
  if (m.includes('already') && m.includes('registered')) return '이미 가입된 이메일이에요. 로그인을 눌러주세요.';
  if (m.includes('email_exists') || m.includes('user_already_exists')) return '이미 가입된 이메일이에요. 로그인을 눌러주세요.';
  if (m.includes('rate limit')) return '잠시 요청이 많아요. 1시간 후에 다시 시도해주세요.';
  if (m.includes('email not confirmed')) return '이메일 확인이 아직 안 됐어요. 메일함을 확인해주세요.';
  if (m.includes('password should be at least')) return '비밀번호는 6자 이상으로 만들어주세요.';
  if (m.includes('valid email')) return '이메일 주소를 다시 확인해주세요.';
  if (m.includes('invalid_code')) return '코드를 다시 확인해주세요. 부모님 앱의 설정에서 볼 수 있어요.';

  // 5xx = 서버 쪽 문제
  if (m.includes('500') || m.includes('502') || m.includes('503') || m.includes('504')) {
    return '서버가 잠시 쉬고 있어요. 잠시 후 다시 시도해주세요.';
  }

  return '문제가 생겼어요. 잠시 후 다시 시도해주세요.';
}
