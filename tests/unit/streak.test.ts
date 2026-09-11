import { describe, expect, it } from 'vitest';
import { computeStreak, weeklyStats } from '../../src/lib/streak';
import { localDateString } from '../../src/lib/dates';
import type { RoutineLog, SlotId } from '../../src/lib/types';

const now = new Date('2026-09-11T00:05:00+09:00');
const enabled: SlotId[] = ['A00', 'A01'];
function log(date: string, slot: SlotId = 'A00'): RoutineLog {
  return { id: `${date}-${slot}`, user_id: 'patient', slot, log_date: date, done_at: `${date}T00:00:00+09:00`, done_by: 'self' };
}
function complete(date: string) { return enabled.map((slot) => log(date, slot)); }

describe('현재 관리 항목과 기기 달력에 따른 진행률', () => {
  it('한국 자정 직후 오늘은 진행 중이어도 어제까지 연속 기록을 유지한다', () => {
    const logs = [...complete('2026-09-09'), ...complete('2026-09-10'), log('2026-09-11')];
    expect(computeStreak(logs, enabled, now)).toBe(2);
    expect(computeStreak([...logs, log('2026-09-11', 'A01')], enabled, now)).toBe(3);
  });

  it('중간에 미완료한 날이 있으면 더 오래된 완료 기록은 연속 일수에 넣지 않는다', () => {
    expect(computeStreak([...complete('2026-09-08'), ...complete('2026-09-10')], enabled, now)).toBe(1);
    expect(computeStreak(complete('2026-09-09'), enabled, now)).toBe(0);
  });

  it('같은 항목의 중복 기록이 하루 모두 완료한 것으로 바뀌지 않는다', () => {
    const logs = [log('2026-09-11'), log('2026-09-11')];
    expect(computeStreak(logs, enabled, now)).toBe(0);
    expect(weeklyStats(logs, enabled, now).at(-1)?.done).toBe(1);
  });

  it('꺼진 항목은 완료 수와 연속 일수에 포함하지 않는다', () => {
    const logs = [log('2026-09-11'), log('2026-09-11', 'A04')];
    expect(computeStreak(logs, enabled, now)).toBe(0);
    expect(weeklyStats(logs, enabled, now).at(-1)?.done).toBe(1);
    expect(computeStreak(logs, ['A00'], now)).toBe(1);
  });

  it('활성 항목이 없으면 기록이 있어도 달성으로 표시하지 않는다', () => {
    expect(computeStreak(complete('2026-09-11'), [], now)).toBe(0);
    expect(weeklyStats(complete('2026-09-11'), [], now).every((day) => day.done === 0)).toBe(true);
    expect(computeStreak([log('2026-09-11')], ['A00', 'A00'], now)).toBe(1);
  });

  it('미래 기록과 7일 밖의 기록은 주간 집계에서 제외한다', () => {
    const week = weeklyStats([...complete('2026-09-04'), ...complete('2026-09-05'), ...complete('2026-09-12')], enabled, now);
    expect(week).toHaveLength(7);
    expect(week[0]).toMatchObject({ date: '2026-09-05', label: '9/5 (토)', done: 2, isToday: false });
    expect(week[6]).toMatchObject({ date: '2026-09-11', label: '9/11 (금)', done: 0, isToday: true });
    expect(week.reduce((sum, day) => sum + day.done, 0)).toBe(2);
    expect(computeStreak(complete('2026-09-12'), enabled, now)).toBe(0);
  });

  it('조회 범위인 오늘 포함 90일까지만 세고 기간 밖의 연속성을 추정하지 않는다', () => {
    const logs = Array.from({ length: 120 }, (_, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      return complete(localDateString(date));
    }).flat();
    expect(computeStreak(logs, enabled, now)).toBe(90);
    expect(computeStreak(logs.filter((item) => item.log_date !== '2026-09-11'), enabled, now)).toBe(89);
  });

  it('주간 날짜가 연도 경계와 윤년을 달력 날짜로 넘는다', () => {
    const newYear = weeklyStats([], enabled, new Date(2027, 0, 1, 0, 5));
    expect(newYear[0].date).toBe('2026-12-26');
    expect(newYear[6].date).toBe('2027-01-01');
    const leapWeek = weeklyStats(complete('2024-02-29'), enabled, new Date(2024, 2, 1, 0, 5));
    expect(leapWeek[5]).toMatchObject({ date: '2024-02-29', done: 2 });
  });
});
