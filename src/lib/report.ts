import { localDateString } from './dates';
import { dailyCounts } from './streak';
import type { RoutineLog, SlotId } from './types';

// A missing log does not establish that care was missed. No inferred enrolment date.
export function reportWeek(logs: RoutineLog[], enabledSlots: readonly SlotId[], now = new Date(), offset = 1) {
  const slots = [...new Set(enabledSlots)];
  const counts = dailyCounts(logs, slots);
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(now); day.setHours(12, 0, 0, 0);
    day.setDate(day.getDate() - offset - 6 + i);
    const date = localDateString(day);
    return { date, label: `${day.getMonth() + 1}/${day.getDate()} (${'일월화수목금토'[day.getDay()]})`, done: counts.get(date)?.size ?? 0 };
  });
  const done = days.reduce((sum, day) => sum + day.done, 0);
  const rate = slots.length && done ? Math.round(done / (slots.length * 7) * 100) : null;
  const missing = slots.map(slot => ({ slot, count: days.filter(day => !counts.get(day.date)?.has(slot)).length }));
  return { days, done, rate, missing, total: slots.length };
}
