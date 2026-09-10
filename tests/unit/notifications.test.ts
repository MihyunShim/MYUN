import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Routine } from '../../src/lib/types';

const native = vi.hoisted(() => ({
  checkPermissions: vi.fn(), requestPermissions: vi.fn(), getPending: vi.fn(), cancel: vi.fn(), schedule: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: native }));
const routine: Routine = { id: 'r1', user_id: 'elder', slot: 'A01', label: '아침 식후', alarm_time: '08:00:00', enabled: true };

beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks();
  native.checkPermissions.mockResolvedValue({ display: 'granted' });
  native.requestPermissions.mockResolvedValue({ display: 'granted' });
  native.getPending.mockResolvedValue({ notifications: [{ id: 1 }, { id: 101 }, { id: 999 }] });
  native.cancel.mockResolvedValue(undefined);
  native.schedule.mockResolvedValue({ notifications: [] });
});
describe('네이티브 알림 예약', () => {
  it('본인 슬롯만 취소하고 안정적인 ID와 매일 시각을 예약한다', async () => {
    const api = await import('../../src/lib/notifications'); api.setNotificationOwner('elder');
    expect(await api.scheduleRoutines([routine])).toBe(true);
    expect(native.cancel).toHaveBeenCalledWith({ notifications: [{ id: 1 }, { id: 101 }] });
    expect(native.schedule.mock.calls[0][0].notifications[0]).toMatchObject({ id: 101, schedule: { on: { hour: 8, minute: 0 } } });
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
});
