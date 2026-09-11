import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { SLOT_DETAIL, type Routine, type SlotId } from './types';
import { isValidTime } from './dates';
import { expectedNotificationSound, prepareNotificationSound } from './voiceNotifications';

const IDS: Record<SlotId, number> = { A00: 100, A01: 101, A02: 102, A03: 103, A04: 104 };
const ROUTINE_IDS = [...Object.values(IDS), 1, 2, 3, 4, 5];
const OWN_IDS = [...ROUTINE_IDS, 199];
export type RoutineNotificationStatus = { expected: number; scheduled: number; verified: boolean };
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

async function cancelOwned(ids = OWN_IDS): Promise<void> {
  const pending = await LocalNotifications.getPending();
  const notifications = pending.notifications.filter((n) => ids.includes(n.id)).map(({ id }) => ({ id }));
  if (notifications.length) await LocalNotifications.cancel({ notifications });
}

// OS에 실제 남아 있는 예약을 읽는다. 권한 허용이나 schedule() 반환만으로 성공으로 보지 않는다.
async function inspectPending(routines: Routine[], userId: string): Promise<RoutineNotificationStatus> {
  const active = routines.filter((r) => r.enabled);
  if (!Capacitor.isNativePlatform()) return { expected: active.length, scheduled: 0, verified: false };
  const { notifications } = await LocalNotifications.getPending();
  const scheduled = active.filter((r) => {
    const [hour, minute] = r.alarm_time.split(':').map(Number);
    return notifications.some((n) => n.id === IDS[r.slot] && n.extra?.owner === userId
      && (Capacitor.getPlatform() !== 'ios' || (n as typeof n & { sound?: string }).sound === expectedNotificationSound())
      && n.schedule?.on?.hour === hour && n.schedule?.on?.minute === minute);
  }).length;
  const unexpected = notifications.some((n) => ROUTINE_IDS.includes(n.id)
    && !active.some((r) => IDS[r.slot] === n.id));
  return { expected: active.length, scheduled, verified: scheduled === active.length && !unexpected };
}

export function routineNotificationStatus(routines: Routine[]): Promise<RoutineNotificationStatus> {
  const requestedOwner = owner;
  return enqueue(async () => {
    if (!requestedOwner || owner !== requestedOwner || routines.some((r) => r.user_id !== requestedOwner)) {
      throw new Error('AUTH_REQUIRED');
    }
    const status = await inspectPending(routines, requestedOwner);
    if (owner !== requestedOwner) throw new Error('AUTH_REQUIRED');
    return status;
  });
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
    // Finish voice generation before replacing working reminders.
    const sound = active.length ? await prepareNotificationSound() : 'default';
    if (!stillOwned()) return false;
    await cancelOwned(ROUTINE_IDS);
    if (!stillOwned()) return false;
    if (!active.length) return true;
    await LocalNotifications.schedule({
      notifications: active.map((r) => {
        const [hour, minute] = r.alarm_time.split(':').map(Number);
        return {
          id: IDS[r.slot],
          title: `${r.label} 틀니 관리 시간이에요`,
          body: SLOT_DETAIL[r.slot].action,
          sound,
          extra: { slot: r.slot, owner: requestedOwner },
          // Capacitor 6 iOS의 on은 UNCalendarNotificationTrigger(repeats: true)로 생성된다.
          schedule: Capacitor.isNativePlatform()
            ? { on: { hour, minute }, allowWhileIdle: true }
            : { at: nextOccurrence(hour, minute) },
        };
      }),
    });
    if (!stillOwned()) { await cancelOwned(ROUTINE_IDS); return false; }
    if (Capacitor.isNativePlatform()) {
      // iOS 플러그인의 schedule 응답과 OS 등록 완료 사이의 짧은 지연만 재확인한다.
      for (let attempt = 0; attempt < 3; attempt++) {
        const status = await inspectPending(active, requestedOwner!);
        if (!stillOwned()) { await cancelOwned(ROUTINE_IDS); return false; }
        if (status.verified) return true;
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 150));
      }
      throw new Error('NOTIFICATION_NOT_REGISTERED');
    }
    return true;
  });
}

export async function sendTestNotification(): Promise<void> {
  const requestedOwner = owner;
  if ((await notificationPermission()) !== 'granted') throw new Error('NOTIFICATION_PERMISSION');
  await enqueue(async () => {
    if (!requestedOwner || owner !== requestedOwner) throw new Error('AUTH_REQUIRED');
    const sound = await prepareNotificationSound();
    if (!requestedOwner || owner !== requestedOwner) throw new Error('AUTH_REQUIRED');
    await LocalNotifications.schedule({ notifications: [{
    id: 199,
    title: '틀니케어 알림 확인',
    body: '시험 알림이 도착했어요. 관리 시간 예약 상태는 앱 설정에서 확인해주세요.',
    sound,
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
