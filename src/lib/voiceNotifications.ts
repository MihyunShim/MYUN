import { Capacitor, registerPlugin } from '@capacitor/core';

export const CARE_VOICE_SOUND = 'denture-care-ko-v1.caf';
export const CARE_VOICE_TEXT = '틀니를 세척할 시간입니다';
const preferenceKey = 'denturecare.notification-voice.v1';
const CareVoice = registerPlugin<{ prepare(): Promise<{ sound: string }> }>('CareVoice');

// Device preference; no account or health information is stored here.
export function voiceNotificationsEnabled(): boolean {
  return localStorage.getItem(preferenceKey) !== 'off';
}
export function setVoiceNotificationsEnabled(enabled: boolean): void {
  localStorage.setItem(preferenceKey, enabled ? 'on' : 'off');
}
export function expectedNotificationSound(): string {
  return Capacitor.getPlatform() === 'ios' && voiceNotificationsEnabled() ? CARE_VOICE_SOUND : 'default';
}
export async function prepareNotificationSound(): Promise<string> {
  if (expectedNotificationSound() === 'default') return 'default';
  try {
    const result = await CareVoice.prepare();
    if (result.sound !== CARE_VOICE_SOUND) throw new Error('Unexpected voice file');
    return result.sound;
  } catch {
    throw new Error('VOICE_PREPARATION_FAILED');
  }
}
