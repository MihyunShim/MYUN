import { localDateString } from './dates';

export interface CheckupSchedule { user_id: string; scheduled_on: string; }

/** SQL DATE: reject calendar rollover and past appointments, using the device's local day. */
export function isValidCheckupDate(value: string, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00');
  return !Number.isNaN(date.getTime()) && localDateString(date) === value
    && value >= localDateString(now) && value <= '9999-12-31';
}

export function nextCheckup(schedule: CheckupSchedule | null, estimatedDate?: string | null) {
  if (schedule) return { date: schedule.scheduled_on, confirmed: true, label: '담당 치과에서 안내받은 검진일' };
  if (estimatedDate) return { date: estimatedDate, confirmed: false, label: '이전 앱에서 계산한 참고일' };
  return null;
}

export function isValidVisitDate(value: string, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00');
  return !Number.isNaN(date.getTime()) && localDateString(date) === value
    && value >= '1900-01-01' && value <= localDateString(now);
}
