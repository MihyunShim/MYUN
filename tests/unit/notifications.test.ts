// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Routine } from '../../src/lib/types';

const native = vi.hoisted(() => ({
  checkPermissions: vi.fn(), requestPermissions: vi.fn(), getPending: vi.fn(), cancel: vi.fn(), schedule: vi.fn(),
  isNative: vi.fn(), platform: vi.fn(), prepareVoice: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: native.isNative, getPlatform: native.platform }, registerPlugin: () => ({ prepare: native.prepareVoice }) }));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: native }));
const routine: Routine = { id: 'r1', user_id: 'elder', slot: 'A01', label: '아침 식후', alarm_time: '08:00:00', enabled: true };

beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks();
  vi.unstubAllGlobals(); localStorage.clear(); native.isNative.mockReturnValue(true);
  native.platform.mockReturnValue('ios');
  native.prepareVoice.mockResolvedValue({ sound: 'denture-care-ko-v1.caf' });
  native.checkPermissions.mockResolvedValue({ display: 'granted' });
  native.requestPermissions.mockResolvedValue({ display: 'granted' });
  let pending: any[] = [{ id: 1 }, { id: 101 }, { id: 199 }, { id: 999 }];
  native.getPending.mockImplementation(async () => ({ notifications: pending }));
  native.cancel.mockImplementation(async ({ notifications }) => {
    pending = pending.filter((n) => !notifications.some((c: { id: number }) => c.id === n.id));
  });
  native.schedule.mockImplementation(async ({ notifications }) => {
    for (const notification of notifications) {
      pending = pending.filter((n) => n.id !== notification.id);
      pending.push(notification);
    }
    return { notifications: notifications.map(({ id }: { id: number }) => ({ id })) };
  });
});
describe('네이티브 알림 예약', () => {
  it('웹 권한을 확인할 때 알림 생성이나 권한 요청을 시도하지 않는다', async () => {
    native.isNative.mockReturnValue(false);
    const requestPermission = vi.fn();
    vi.stubGlobal('Notification', { permission: 'default', requestPermission });
    const api = await import('../../src/lib/notifications');
    expect(await api.notificationPermission()).toBe('prompt');
    expect(native.checkPermissions).not.toHaveBeenCalled();
    expect(requestPermission).not.toHaveBeenCalled();
  });
  it('본인 슬롯만 취소하고 안정적인 ID와 매일 시각을 예약한다', async () => {
    const api = await import('../../src/lib/notifications'); api.setNotificationOwner('elder');
    expect(await api.scheduleRoutines([routine])).toBe(true);
    expect(native.cancel).toHaveBeenCalledWith({ notifications: [{ id: 1 }, { id: 101 }] });
    expect(native.schedule.mock.calls[0][0].notifications[0]).toMatchObject({ id: 101, sound: 'denture-care-ko-v1.caf', schedule: { on: { hour: 8, minute: 0 } } });
  });
  it('권한 거부를 예약 성공으로 표시하지 않는다', async () => {
    const api = await import('../../src/lib/notifications'); api.setNotificationOwner('elder');
    native.requestPermissions.mockResolvedValue({ display: 'denied' });
    expect(await api.enableNotifications([routine])).toBe(false);
    expect(native.schedule).not.toHaveBeenCalled();
  });
  it('예약 실패는 호출 화면에 전달하고 다음 재시도는 실행한다', async () => {
    const api = await import('../../src/lib/notifications'); api.setNotificationOwner('elder');
    native.schedule.mockRejectedValueOnce(new Error('device failure'));
    await expect(api.scheduleRoutines([routine])).rejects.toThrow('device failure');
    expect(await api.scheduleRoutines([routine])).toBe(true);
  });
  it('로그아웃 전에 시작된 늦은 예약이 로그아웃 뒤 되살아나지 않는다', async () => {
    const api = await import('../../src/lib/notifications'); api.setNotificationOwner('elder');
    let permit!: (value: { display: string }) => void;
    native.checkPermissions.mockImplementationOnce(() => new Promise((resolve) => { permit = resolve; }));
    const pending = api.scheduleRoutines([routine]);
    await vi.waitFor(() => expect(permit).toBeTypeOf('function'));
    api.setNotificationOwner(null);
    const cancellation = api.cancelRoutineNotifications();
    permit({ display: 'granted' });
    expect(await pending).toBe(false); await cancellation;
    expect(native.schedule).not.toHaveBeenCalled();
  });
  it('다른 계정의 예약과 잘못된 시간을 거부한다', async () => {
    const api = await import('../../src/lib/notifications'); api.setNotificationOwner('other');
    expect(await api.scheduleRoutines([routine])).toBe(false);
    api.setNotificationOwner('elder');
    await expect(api.scheduleRoutines([{ ...routine, alarm_time: '24:99' }])).rejects.toThrow('INVALID_ROUTINE_TIME');
    expect(native.schedule).not.toHaveBeenCalled();
  });
  it('허용된 권한과 OS 실제 예약 개수를 구분하며 잘못된 시각도 감지한다', async () => {
    const api = await import('../../src/lib/notifications'); api.setNotificationOwner('elder');
    expect(await api.notificationPermission()).toBe('granted');
    expect(await api.routineNotificationStatus([routine])).toEqual({ expected: 1, scheduled: 0, verified: false });
    await api.scheduleRoutines([routine]);
    expect(await api.routineNotificationStatus([routine])).toEqual({ expected: 1, scheduled: 1, verified: true });
    expect(await api.routineNotificationStatus([{ ...routine, alarm_time: '09:00' }])).toEqual({ expected: 1, scheduled: 0, verified: false });
  });
  it('플러그인이 성공을 반환해도 OS에 예약이 없으면 제한된 조회 후 실패한다', async () => {
    const api = await import('../../src/lib/notifications'); api.setNotificationOwner('elder');
    native.schedule.mockResolvedValue({ notifications: [{ id: 101 }] });
    await expect(api.scheduleRoutines([routine])).rejects.toThrow('NOTIFICATION_NOT_REGISTERED');
    expect(native.schedule).toHaveBeenCalledTimes(1);
    expect(native.getPending).toHaveBeenCalledTimes(4); // 취소용 1회 + 확인 3회
  });
  it('OS 등록이 약간 늦으면 재예약 없이 확인만 재시도한다', async () => {
    const api = await import('../../src/lib/notifications'); api.setNotificationOwner('elder');
    native.getPending.mockImplementationOnce(native.getPending.getMockImplementation()!).mockResolvedValueOnce({ notifications: [] });
    expect(await api.scheduleRoutines([routine])).toBe(true);
    expect(native.schedule).toHaveBeenCalledTimes(1);
    expect(native.getPending).toHaveBeenCalledTimes(3);
  });
  it('관리 알림을 재적용해도 시험 알림은 남고 로그아웃하면 함께 취소한다', async () => {
    const api = await import('../../src/lib/notifications'); api.setNotificationOwner('elder');
    await api.sendTestNotification();
    await api.scheduleRoutines([routine]);
    expect((await native.getPending()).notifications.some((n: { id: number }) => n.id === 199)).toBe(true);
    api.setNotificationOwner(null);
    await api.cancelRoutineNotifications();
    expect((await native.getPending()).notifications.map((n: { id: number }) => n.id)).toEqual([999]);
  });
  it('OS 예약 처리 도중 계정이 바뀌어도 이전 사용자의 알림을 남기지 않는다', async () => {
    const api = await import('../../src/lib/notifications'); api.setNotificationOwner('elder');
    const originalSchedule = native.schedule.getMockImplementation()!;
    native.schedule.mockImplementationOnce(async (options) => {
      await originalSchedule(options);
      api.setNotificationOwner('other');
    });
    expect(await api.scheduleRoutines([routine])).toBe(false);
    expect((await native.getPending()).notifications.some((n: { id: number }) => n.id === 101)).toBe(false);
  });

  it('음성 준비에 실패하면 기존 예약을 취소하지 않고 재시도할 수 있다', async () => {
    const api = await import('../../src/lib/notifications'); api.setNotificationOwner('elder');
    native.prepareVoice.mockRejectedValueOnce(new Error('no Korean voice'));
    await expect(api.scheduleRoutines([routine])).rejects.toThrow('VOICE_PREPARATION_FAILED');
    expect(native.cancel).not.toHaveBeenCalled();
    expect(native.schedule).not.toHaveBeenCalled();
    expect(await api.scheduleRoutines([routine])).toBe(true);
  });
  it('기본음 선택 시 음성 생성을 건너뛰고 기존 음성 예약을 미적용으로 표시한다', async () => {
    const api = await import('../../src/lib/notifications'); api.setNotificationOwner('elder');
    const voice = await import('../../src/lib/voiceNotifications');
    await api.scheduleRoutines([routine]);
    voice.setVoiceNotificationsEnabled(false);
    expect((await api.routineNotificationStatus([routine])).verified).toBe(false);
    native.prepareVoice.mockClear();
    await api.sendTestNotification();
    expect(native.prepareVoice).not.toHaveBeenCalled();
    expect(native.schedule.mock.lastCall?.[0].notifications[0].sound).toBe('default');
  });
  it('시험 알림은 음성 파일 완성 후 10초 뒤로 예약한다', async () => {
    const api = await import('../../src/lib/notifications'); api.setNotificationOwner('elder');
    let ready!: (value: { sound: string }) => void;
    native.prepareVoice.mockImplementationOnce(() => new Promise((resolve) => { ready = resolve; }));
    const request = api.sendTestNotification();
    await vi.waitFor(() => expect(ready).toBeTypeOf('function'));
    expect(native.schedule).not.toHaveBeenCalled();
    const before = Date.now(); ready({ sound: 'denture-care-ko-v1.caf' }); await request;
    const notice = native.schedule.mock.lastCall?.[0].notifications[0];
    expect(notice.sound).toBe('denture-care-ko-v1.caf');
    expect(notice.schedule.at.getTime()).toBeGreaterThanOrEqual(before + 10000);
  });
  it('음성 준비 도중 로그아웃하면 시험 알림을 예약하지 않는다', async () => {
    const api = await import('../../src/lib/notifications'); api.setNotificationOwner('elder');
    native.prepareVoice.mockImplementationOnce(async () => { api.setNotificationOwner(null); return { sound: 'denture-care-ko-v1.caf' }; });
    await expect(api.sendTestNotification()).rejects.toThrow('AUTH_REQUIRED');
    expect(native.schedule).not.toHaveBeenCalled();
  });

});
