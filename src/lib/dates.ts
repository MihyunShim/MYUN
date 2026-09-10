// SQL DATE 값은 UTC 시각이 아니라 사용자의 달력 날짜로 다룬다.
export function localDateString(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function addMonthsClamped(date: Date, months: number): Date {
  const next = new Date(date);
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}

export function calendarDaysUntil(date: string, now = new Date()): number {
  const [year, month, day] = date.split('-').map(Number);
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
}

export function isValidDentureDate(year: number, month: number, now = new Date()): boolean {
  return Number.isInteger(year) && Number.isInteger(month)
    && year >= 1900 && month >= 1 && month <= 12
    && year * 12 + month <= now.getFullYear() * 12 + now.getMonth() + 1;
}

export function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time);
}
