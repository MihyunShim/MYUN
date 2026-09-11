import { Capacitor, registerPlugin } from '@capacitor/core';

export const CARE_VOICE_SOUND = 'denture-care-ko-v1.caf';
export const CARE_VOICE_TEXT = '틀니를 세척할 시간입니다';
const preferenceKey = 'denturecare.notification-voice.v1';
export interface VoiceStatus { ready: boolean; durationSeconds?: number; bytes?: number; reason?: string; }
const CareVoice = registerPlugin<{
  prepare(options?: { force?: boolean }): Promise<{ sound: string }>;
  status(): Promise<VoiceStatus>;
  preview(): Promise<{ played: boolean }>;
}>('CareVoice');

// Device preference; no account or health information is stored here.
export function voiceNotificationsEnabled(): boolean {
  try { return localStorage.getItem(preferenceKey) !== 'off'; } catch { return false; }
}
export function setVoiceNotificationsEnabled(enabled: boolean): void {
  localStorage.setItem(preferenceKey, enabled ? 'on' : 'off');
}
export function expectedNotificationSound(): string {
  return Capacitor.getPlatform() === 'ios' && voiceNotificationsEnabled() ? CARE_VOICE_SOUND : 'default';
}
export function voiceErrorMessage(error: unknown): string {
  const detail = error as { code?: string; message?: string } | null;
  const code = detail?.code ?? '';
  if (code === 'UNIMPLEMENTED' || /not implemented/i.test(detail?.message ?? '')) return '음성 기능이 포함된 앱으로 다시 설치해주세요. 앱 안내의 설치 버전을 확인할 수 있어요.';
  if (code === 'VOICE_UNAVAILABLE') return '아이폰에서 한국어 음성을 사용할 수 없어요. 한국어 음성을 준비하거나 기본 알림음을 선택해주세요.';
  if (code === 'VOICE_TIMEOUT') return '음성 준비가 오래 걸리고 있어요. 앱을 켜둔 채 다시 준비해주세요.';
  if (code === 'PREVIEW_INTERRUPTED') return '미리 듣기를 중단했어요. 앱을 켜둔 채 다시 들어주세요.';
  if (code === 'VOICE_NOT_READY') return '음성이 아직 준비되지 않았어요. 음성 다시 준비하기를 눌러주세요.';
  return '음성 안내를 확인하지 못했어요. 음성을 다시 준비하거나 기본 알림음을 선택해주세요.';
}
export async function prepareVoice(force = false): Promise<string> {
  try {
    const result = await CareVoice.prepare({ force });
    if (result.sound !== CARE_VOICE_SOUND) throw new Error('Unexpected voice file');
    return result.sound;
  } catch (error) {
    throw new Error(`VOICE_PREPARATION_FAILED: ${voiceErrorMessage(error)}`);
  }
}
export async function prepareNotificationSound(): Promise<string> {
  return expectedNotificationSound() === 'default' ? 'default' : prepareVoice();
}
export async function getVoiceStatus(): Promise<VoiceStatus> { return CareVoice.status(); }
export async function previewVoice(): Promise<void> {
  await prepareVoice();
  const result = await CareVoice.preview();
  if (!result.played) throw new Error('PREVIEW_FAILED');
}
