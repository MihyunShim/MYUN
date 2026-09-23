import { localDateString } from './dates';
import type { RoutineLog, SlotId } from './types';

export const PROGRESS_WINDOW_DAYS = 90;

export function dailyCounts(logs: RoutineLog[], enabledSlots: readonly SlotId[]) {
  const enabled = new Set(enabledSlots);
  const byDate = new Map<string, Set<SlotId>>();
  for (const log of logs) {
    if (!enabled.has(log.slot)) continue;
    const slots = byDate.get(log.log_date) ?? new Set<SlotId>();
    slots.add(log.slot);
    byDate.set(log.log_date, slots);
  }
  return byDate;
}

// 현재 켜진 관리 항목을 기준으로 기기의 달력 날짜에 따라 최대 90일을 집계한다.
// 오늘이 미완료여도 어제까지의 연속 기록은 유지한다.
export function computeStreak(logs: RoutineLog[], enabledSlots: readonly SlotId[], now = new Date()): number {
  const totalSlots = new Set(enabledSlots).size;
  if (totalSlots === 0) return 0;
  const byDate = dailyCounts(logs, enabledSlots);
  const cursor = new Date(now);
  cursor.setHours(12, 0, 0, 0);
  let streak = 0;
  for (let offset = 0; offset < PROGRESS_WINDOW_DAYS; offset++) {
    const complete = (byDate.get(localDateString(cursor))?.size ?? 0) === totalSlots;
    if (complete) streak += 1;
    else if (offset > 0) break;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function weeklyStats(logs: RoutineLog[], enabledSlots: readonly SlotId[], now = new Date()) {
  const byDate = dailyCounts(logs, enabledSlots);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - 6 + i);
    const key = localDateString(date);
    return {
      date: key,
      label: `${date.getMonth() + 1}/${date.getDate()} (${'일월화수목금토'[date.getDay()]})`,
      done: byDate.get(key)?.size ?? 0,
      hasRecords: byDate.has(key),
      isToday: i === 6,
    };
  });
}
