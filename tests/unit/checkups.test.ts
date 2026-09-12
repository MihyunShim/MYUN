import { describe, expect, it } from 'vitest';
import { isValidCheckupDate, nextCheckup } from '../../src/lib/checkups';

describe('담당 치과 검진 일정', () => {
  const now = new Date(2026, 8, 11, 0, 5);
  it('오늘과 이후의 실제 달력 날짜만 받는다', () => {
    for (const value of ['2026-09-11', '2026-09-12', '2028-02-29']) expect(isValidCheckupDate(value, now)).toBe(true);
    for (const value of ['', '2026-09-10', '2026-02-29', '2027-02-29', '2026-13-01', '2026-09-31', '2026-9-12', '2026-09-12T00:00:00Z']) expect(isValidCheckupDate(value, now)).toBe(false);
  });
  it('자동 계산보다 치과 안내일을 우선하며 지난 일정도 몰래 바꾸지 않는다', () => {
    expect(nextCheckup({ user_id: 'owner', scheduled_on: '2026-09-01' }, '2026-12-01')).toEqual({
      date: '2026-09-01', confirmed: true, label: '담당 치과에서 안내받은 검진일',
    });
  });
  it('안내일 삭제 후 남은 자동 계산일은 예약일로 표시하지 않는다', () => {
    expect(nextCheckup(null, '2026-12-01')).toEqual({ date: '2026-12-01', confirmed: false, label: '이전 앱에서 계산한 참고일' });
    expect(nextCheckup(null)).toBeNull();
  });
});
