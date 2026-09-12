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
  if (err instanceof Error && err.message.startsWith('VOICE_PREPARATION_FAILED: ')) return err.message.slice('VOICE_PREPARATION_FAILED: '.length);
  if (m.includes('voice_preparation_failed')) return '한국어 음성 안내를 준비하지 못했어요. 앱을 켜둔 채 다시 시도하거나 기본 알림음을 선택해주세요.';
  if (m.includes('anonymous_provider_disabled') || m.includes('anonymous sign-ins are disabled')) return '가입 없는 보호자 연결이 아직 서버에서 준비되지 않았어요. 앱 운영자에게 문의해주세요.';
  if (m.includes('request_expired')) return '요청이 만료되었거나 이미 처리됐어요. 목록을 다시 확인해주세요.';
  if (m.includes('request_pending')) return '먼저 보낸 연결 요청을 취소한 뒤 다시 요청해주세요.';
  if (m.includes('request_not_allowed')) return '이 요청을 처리할 권한이 없어요. 목록을 다시 확인해주세요.';
  if (m.includes('guardian_required')) return '보호자 계정으로 로그인한 뒤 연결해주세요.';
  if (m.includes('cannot_link_self')) return '본인 계정에는 연결할 수 없어요. 보호자의 별도 계정을 사용해주세요.';
  if (m.includes('link_with_invite_code') && m.includes('pgrst202')) return '가족 연결 기능을 아직 사용할 수 없어요. 앱 운영자에게 문의해주세요.';
  if (m.includes('invalid_routine_time')) return '관리 시간을 다시 골라주세요.';
  if (m.includes('pgrst202') || m.includes('delete_own_account') || m.includes('list_my_care_links')) return '계정 관리 기능을 아직 사용할 수 없어요. 앱 운영자에게 문의해주세요.';

  // 서버에 아예 닿지 못한 경우 (연결 실패 · 서버 일시정지 · 인터넷 끊김)
  // Supabase 무료 플랜은 7일 미사용 시 프로젝트가 자동 일시정지되어 주소 자체가 사라진다
  if (
    m.includes('fetch') || m.includes('network') || m.includes('load failed') ||
    m.includes('econnrefused') || m.includes('enotfound') || m.includes('dns') ||
    m.includes('typeerror') || m.includes('status 0') || m.includes('aborted')
  ) {
    return '서버에 연결할 수 없어요. 인터넷 연결을 확인하시거나, 잠시 후 다시 시도해주세요.';
  }

  if (m.includes('provider is not enabled') || m.includes('unsupported provider')) {
    return '카카오 로그인은 아직 준비 중이에요. 이메일로 가입해주세요.';
  }
  if (m.includes('invalid login credentials')) return '이메일 또는 비밀번호가 맞지 않아요. 다시 확인해주세요.';
  if (m.includes('already') && m.includes('registered')) return '이미 가입된 이메일이에요. 로그인을 눌러주세요.';
  if (m.includes('email_exists') || m.includes('user_already_exists')) return '이미 가입된 이메일이에요. 로그인을 눌러주세요.';
  if (m.includes('rate limit')) return '잠시 요청이 많아요. 1시간 후에 다시 시도해주세요.';
  if (m.includes('email not confirmed')) return '이메일 확인이 아직 안 됐어요. 메일함을 확인해주세요.';
  if (m.includes('password should be at least')) return '비밀번호는 6자 이상으로 만들어주세요.';
  if (m.includes('valid email')) return '이메일 주소를 다시 확인해주세요.';
  if (m.includes('invalid_code')) return '초대코드가 맞지 않거나 변경됐어요. 틀니 사용자 앱의 설정에서 최신 코드를 확인해주세요.';

  // 5xx = 서버 쪽 문제
  if (m.includes('500') || m.includes('502') || m.includes('503') || m.includes('504')) {
    return '서버가 잠시 쉬고 있어요. 잠시 후 다시 시도해주세요.';
  }

  return '문제가 생겼어요. 잠시 후 다시 시도해주세요.';
}
