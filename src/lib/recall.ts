// 제작 연월은 사용 기간 표시용이다. 구강 상태나 검진 간격을 추론하지 않는다.
import { isValidDentureDate } from './dates';

export interface RecallInfo {
  phase: string;
  monthsSince: number;
  note: string;
}

export function calculateRecall(madeYear: number, madeMonth: number): RecallInfo | null {
  if (!isValidDentureDate(madeYear, madeMonth)) return null;
  const today = new Date();
  const monthsSince = (today.getFullYear() - madeYear) * 12 + today.getMonth() + 1 - madeMonth;
  const years = Math.floor(monthsSince / 12);
  const months = monthsSince % 12;
  const phase = monthsSince === 0 ? '이번 달에 제작했어요'
    : `제작한 지 ${years ? `${years}년 ` : ''}${months ? `${months}개월` : ''}`.trim();
  return { phase, monthsSince, note: '검진 간격과 교체 필요 여부는 담당 치과에 확인해주세요.' };
}
