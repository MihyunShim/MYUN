import { expect, it } from 'vitest';
import { reportWeek } from '../../src/lib/report';
import type { RoutineLog } from '../../src/lib/types';
const now = new Date(2026, 8, 23, 0, 5);
const log = (date: string, slot: RoutineLog['slot'] = 'A00'): RoutineLog => ({ id: date + slot, user_id: 'u', slot, log_date: date, done_at: '', done_by: 'self' });
it('기록 없음과 관리 항목 없음은 0% 실천으로 단정하지 않는다', () => {
  expect(reportWeek([], ['A00'], now).rate).toBeNull();
  expect(reportWeek([log('2026-09-22')], [], now)).toMatchObject({ rate: null, total: 0, done: 0 });
});
it('중복·미래·오늘·비활성 기록을 제외해 100%를 넘기지 않는다', () => {
  const logs = Array.from({ length: 7 }, (_, i) => log(`2026-09-${16 + i}`));
  const week = reportWeek([...logs, ...logs, log('2026-09-23'), log('2026-09-24'), log('2026-09-22', 'A04')], ['A00', 'A00'], now);
  expect(week).toMatchObject({ done: 7, total: 1, rate: 100, missing: [{ slot: 'A00', count: 0 }] });
});
it('부분 기록과 이전 주 기록을 독립적으로 계산한다', () => {
  const logs = [log('2026-09-22'), log('2026-09-15'), log('2026-09-22', 'A01')];
  expect(reportWeek(logs, ['A00', 'A01'], now)).toMatchObject({ rate: 14, done: 2 });
  expect(reportWeek(logs, ['A00', 'A01'], now, 8)).toMatchObject({ rate: 7, done: 1 });
});
it('자정과 연도 경계에서 완료된 7일의 범위를 바꾼다', () => {
  expect(reportWeek([], ['A00'], new Date(2027, 0, 1, 0, 1)).days.map(day => day.date)).toEqual(['2026-12-25', '2026-12-26', '2026-12-27', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31']);
  expect(reportWeek([log('2026-09-23')], ['A00'], new Date(2026, 8, 24, 0, 1)).done).toBe(1);
});
