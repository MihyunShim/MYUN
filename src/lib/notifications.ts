import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { SLOT_DETAIL, type Routine } from './types';

// 루틴 시간 기기 알림 (Capacitor local-notifications)
// - 네이티브 앱(iOS/Android): 매일 반복 알림 — 앱이 꺼져 있어도 울림
// - 웹(브라우저/PWA): 다음 1회 예약 — 앱이 열려 있을 때만 울림 (웹의 한계)

export async function notificationPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  try {
    const s = await LocalNotifications.checkPermissions();
    return s.display === 'granted' ? 'granted' : s.display === 'denied' ? 'denied' : 'prompt';
  } catch {
    return 'denied';
  }
}

export async function enableNotifications(routines: Routine[]): Promise<boolean> {
  try {
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return false;
    await scheduleRoutines(routines);
    return true;
  } catch {
    return false;
  }
}

export async function scheduleRoutines(routines: Routine[]): Promise<void> {
  try {
    if ((await notificationPermission()) !== 'granted') return;

    // 기존 예약을 모두 지우고 새로 등록 (시간 변경 반영)
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }

    const active = routines.filter((r) => r.enabled);
    await LocalNotifications.schedule({
      notifications: active.map((r, i) => {
        const [hour, minute] = r.alarm_time.split(':').map(Number);
        return {
          id: i + 1,
          title: `${r.label} 틀니 관리 시간이에요`,
          body: SLOT_DETAIL[r.slot].action,
          schedule: Capacitor.isNativePlatform()
            ? { on: { hour, minute }, allowWhileIdle: true } // 매일 반복
            : { at: nextOccurrence(hour, minute) },          // 웹: 다음 1회
        };
      }),
    });
  } catch {
    // 웹 환경에 따라 일부 기능이 없을 수 있음 — 앱 사용을 막지 않는다
  }
}

function nextOccurrence(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
}
