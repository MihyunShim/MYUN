import type { RoutineLog } from './types';

// 연속 달성일 계산: 하루 5개 루틴을 모두 완료한 날이 "달성일"
// 오늘은 아직 진행 중일 수 있으므로, 오늘 미완료여도 어제까지 이어졌으면 유지
export function computeStreak(logs: RoutineLog[], totalSlots: number): number {
  if (totalSlots === 0) return 0;
  const byDate = new Map<string, number>();
  for (const l of logs) byDate.set(l.log_date, (byDate.get(l.log_date) ?? 0) + 1);

  const dateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  let streak = 0;
  const cursor = new Date();
  // 오늘 완료했으면 오늘부터, 아니면 어제부터 거슬러 센다
  if ((byDate.get(dateStr(cursor)) ?? 0) >= totalSlots) streak = 1;
  cursor.setDate(cursor.getDate() - 1);

  while ((byDate.get(dateStr(cursor)) ?? 0) >= totalSlots) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// 최근 7일 달성 현황 (요일 라벨 + 완료 개수)
export function weeklyStats(logs: RoutineLog[]): { label: string; done: number }[] {
  const byDate = new Map<string, number>();
  for (const l of logs) byDate.set(l.log_date, (byDate.get(l.log_date) ?? 0) + 1);

  const out: { label: string; done: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    out.push({ label: '일월화수목금토'[d.getDay()], done: byDate.get(key) ?? 0 });
  }
  return out;
}
