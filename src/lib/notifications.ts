import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { SLOT_DETAIL, type Routine, type SlotId } from './types';
import { isValidTime } from './dates';

const IDS: Record<SlotId, number> = { A00: 100, A01: 101, A02: 102, A03: 103, A04: 104 };
const OWN_IDS = [...Object.values(IDS), 1, 2, 3, 4, 5, 199];
export type NotificationPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';

// 예약 변경과 로그아웃을 순서대로 처리해 이전 예약이 되살아나지 않게 한다.
let queue: Promise<unknown> = Promise.resolve();
let owner: string | null = null;
export function setNotificationOwner(userId: string | null): void { owner = userId; }
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.then(operation, operation);
  queue = result.catch(() => undefined);
  return result;
}

export async function notificationPermission(): Promise<NotificationPermission> {
  if (!Capacitor.isNativePlatform()) {
    if (!('Notification' in globalThis)) return 'unsupported';
    // 웹 플러그인은 권한 검사 중 빈 알림 생성을 시도한다. 조회는 브라우저 속성만 읽는다.
    return Notification.permission === 'default' ? 'prompt' : Notification.permission;
  }
  const s = await LocalNotifications.checkPermissions();
  return s.display === 'granted' ? 'granted' : s.display === 'denied' ? 'denied' : 'prompt';
}

async function cancelOwned(): Promise<void> {
  const pending = await LocalNotifications.getPending();
  const notifications = pending.notifications.filter((n) => OWN_IDS.includes(n.id)).map(({ id }) => ({ id }));
  if (notifications.length) await LocalNotifications.cancel({ notifications });
}

export function cancelRoutineNotifications(): Promise<void> {
  return enqueue(async () => {
    if (!Capacitor.isNativePlatform() && !('Notification' in globalThis)) return;
    await cancelOwned();
  });
}

export async function enableNotifications(routines: Routine[]): Promise<boolean> {
  if ((await notificationPermission()) === 'unsupported') return false;
  const granted = Capacitor.isNativePlatform()
    ? (await LocalNotifications.requestPermissions()).display === 'granted'
    : await Notification.requestPermission() === 'granted';
  if (!granted) return false;
  return scheduleRoutines(routines);
}

export function scheduleRoutines(routines: Routine[]): Promise<boolean> {
  const requestedOwner = owner;
  return enqueue(async () => {
    const stillOwned = () => requestedOwner !== null && owner === requestedOwner
      && routines.every((r) => r.user_id === requestedOwner);
    if (!stillOwned()) return false;
    const active = routines.filter((r) => r.enabled);
    if (active.some((r) => !isValidTime(r.alarm_time) || !(r.slot in IDS))) {
      throw new Error('INVALID_ROUTINE_TIME');
    }
    if ((await notificationPermission()) !== 'granted') return false;
    if (!stillOwned()) return false;
    await cancelOwned();
    if (!stillOwned()) return false;
    if (!active.length) return true;
    await LocalNotifications.schedule({
      notifications: active.map((r) => {
        const [hour, minute] = r.alarm_time.split(':').map(Number);
        return {
          id: IDS[r.slot],
          title: `${r.label} 틀니 관리 시간이에요`,
          body: SLOT_DETAIL[r.slot].action,
          sound: 'default',
          extra: { slot: r.slot },
          // Capacitor 6 iOS의 on은 UNCalendarNotificationTrigger(repeats: true)로 생성된다.
          schedule: Capacitor.isNativePlatform()
            ? { on: { hour, minute }, allowWhileIdle: true }
            : { at: nextOccurrence(hour, minute) },
        };
      }),
    });
    return true;
  });
}

export async function sendTestNotification(): Promise<void> {
  const requestedOwner = owner;
  if ((await notificationPermission()) !== 'granted') throw new Error('NOTIFICATION_PERMISSION');
  await enqueue(async () => {
    if (!requestedOwner || owner !== requestedOwner) throw new Error('AUTH_REQUIRED');
    await LocalNotifications.schedule({ notifications: [{
    id: 199,
    title: '틀니케어 알림 확인',
    body: '알림이 잘 도착했어요. 설정한 관리 시간에도 알려드릴게요.',
    sound: 'default',
    schedule: { at: new Date(Date.now() + 10000) },
    }] });
  });
}

function nextOccurrence(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
}
