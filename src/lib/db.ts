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
  if (m.includes('request_timeout')) return '서버 응답이 늦어 확인을 마치지 못했어요. 저장·삭제·요청 중이었다면 반영됐을 수 있으니, 먼저 다시 불러와 확인해주세요.';
  if (err instanceof Error && err.message.startsWith('VOICE_PREPARATION_FAILED: ')) return err.message.slice('VOICE_PREPARATION_FAILED: '.length);
  if (m.includes('voice_preparation_failed')) return '한국어 음성 안내를 준비하지 못했어요. 앱을 켜둔 채 다시 시도하거나 기본 알림음을 선택해주세요.';
  if (m.includes('anonymous_provider_disabled') || m.includes('anonymous sign-ins are disabled')) return '가입 없는 보호자 연결이 아직 서버에서 준비되지 않았어요. 앱 운영자에게 문의해주세요.';
  if (m.includes('privacy_notice_unavailable')) return '개인정보 안내가 아직 준비되지 않았어요. 잠시 후 다시 확인해주세요.';
  if (m.includes('privacy_consent_required') || m.includes('guardian_privacy_required')) return '최신 개인정보 안내와 동의 상태를 확인해주세요. 가족도 자신의 앱에서 확인해야 해요.';
  if (m.includes('guardian_sharing_required')) return '보호자가 개인정보 제공에 동의한 새 요청이 필요해요. 기존 요청을 취소하고 다시 보내주세요.';
  if (m.includes('sharing_consent_required')) return '공유할 개인정보와 건강정보를 확인한 뒤 각각 동의해주세요.';
  if (m.includes('use_health_withdrawal')) return '기존 건강정보 동의를 철회하려면 개인정보 관리에서 건강정보 삭제·동의 철회를 이용해주세요.';
  if (m.includes('already_linked')) return '이미 연결된 가족이 있어요. 가족 현황을 확인하거나 기존 연결을 해제한 뒤 요청해주세요.';
  if (m.includes('visit_changed')) return '검진 기록이 변경되었거나 없어요. 다시 불러온 뒤 확인해주세요.';
  if (m.includes('visit_duplicate')) return '같은 날짜의 검진 기록이 이미 있어요. 날짜를 확인해주세요.';
  if (m.includes('visit_not_allowed')) return '본인의 검진 기록만 수정할 수 있어요.';
  if (m.includes('invalid_visit_date')) return '실제 검진을 받은 날짜를 다시 확인해주세요.';
  if (m.includes('request_expired')) return '요청이 만료되었거나 이미 처리됐어요. 목록을 다시 확인해주세요.';
  if (m.includes('request_pending')) return '먼저 보낸 연결 요청을 취소한 뒤 다시 요청해주세요.';
  if (m.includes('request_not_allowed')) return '이 요청을 처리할 권한이 없어요. 목록을 다시 확인해주세요.';
  if (m.includes('guardian_required')) return '보호자 계정으로 로그인한 뒤 연결해주세요.';
  if (m.includes('cannot_link_self')) return '본인 계정에는 연결할 수 없어요. 보호자의 별도 계정을 사용해주세요.';
  if (m.includes('link_with_invite_code') && m.includes('pgrst202')) return '가족 연결 기능을 아직 사용할 수 없어요. 앱 운영자에게 문의해주세요.';
  if (m.includes('invalid_routine_time')) return '관리 시간을 다시 골라주세요.';
  if (m.includes('pgrst202') || m.includes('delete_own_account') || m.includes('list_my_care_links')) return '이 기능의 서버 업데이트가 아직 준비되지 않았어요. 앱 운영자에게 문의해주세요.';

  // 서버에 아예 닿지 못한 경우 (연결 실패 · 서버 일시정지 · 인터넷 끊김)
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
  if (m.includes('rate limit') || m.includes('over_email_send_rate_limit') || m.includes('over_request_rate_limit') || m.includes('429')) return '요청이 많아 잠시 제한됐어요. 조금 기다린 뒤 다시 시도해주세요.';
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
