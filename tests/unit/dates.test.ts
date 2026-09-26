import { afterEach, describe, expect, it, vi } from 'vitest';
import { addMonthsClamped, calendarDaysUntil, isValidDentureDate, isValidTime, localDateString } from '../../src/lib/dates';
import { calculateRecall } from '../../src/lib/recall';

afterEach(() => vi.useRealTimers());
describe('사용자의 달력 날짜', () => {
  it('한국 자정 직후 기록을 전날 UTC 날짜로 저장하지 않는다', () => {
    const now = new Date('2026-09-10T00:05:00+09:00');
    expect(localDateString(now)).toBe('2026-09-10');
    expect(calendarDaysUntil('2026-09-10', now)).toBe(0);
    expect(calendarDaysUntil('2026-09-09', now)).toBe(-1);
  });
  it('월말 검진은 다음 달 말일 안에 머물고 윤년을 반영한다', () => {
    const original = new Date(2026, 0, 31, 12);
    expect(localDateString(addMonthsClamped(original, 1))).toBe('2026-02-28');
    expect(localDateString(original)).toBe('2026-01-31');
    expect(localDateString(addMonthsClamped(new Date(2024, 0, 31), 1))).toBe('2024-02-29');
    expect(localDateString(addMonthsClamped(new Date(2026, 7, 31), 6))).toBe('2027-02-28');
  });
  it('미래 제작일과 잘못된 월·소수·빈 값을 거부한다', () => {
    const now = new Date(2026, 8, 10);
    for (const [year, month] of [[2026, 10], [2027, 1], [2026, 0], [2026, 13], [2026.5, 1], [NaN, 1], [0, 0]]) {
      expect(isValidDentureDate(year, month, now)).toBe(false);
    }
    expect(isValidDentureDate(2026, 9, now)).toBe(true);
  });
  it('제작 기간만 표시하고 건강 상태나 검진 간격을 추정하지 않는다', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 10));
    expect(calculateRecall(2027, 1)).toBeNull();
    expect(calculateRecall(2026, 13)).toBeNull();
    expect(calculateRecall(2026, 9)?.monthsSince).toBe(0);
    expect(calculateRecall(2020, 1)).not.toHaveProperty('intervalMonths');
    expect(calculateRecall(2020, 1)).not.toHaveProperty('urgency');
  });
  it('시간 선택기와 SQL TIME 값을 검증한다', () => {
    for (const time of ['00:00', '23:59', '07:00:00']) expect(isValidTime(time)).toBe(true);
    for (const time of ['', '24:00', '12:60', '7:00', '12:00:99']) expect(isValidTime(time)).toBe(false);
  });
});
