// 틀니 제작 시기 기반 치과 검진(리콜) 주기 계산
// 프로토타입 v12의 calculateRecall 로직 계승 (Tallgren 1972 골흡수 근거)

export interface RecallInfo {
  phase: string;
  intervalMonths: number;
  monthsSince: number;
  nextRecall: Date;
  dDay: number;
  urgency: 'high' | 'medium' | 'normal';
  note: string;
}

export function calculateRecall(madeYear: number, madeMonth: number): RecallInfo | null {
  if (!madeYear || !madeMonth) return null;
  const made = new Date(madeYear, madeMonth - 1, 1);
  const today = new Date();
  const monthsSince =
    (today.getFullYear() - made.getFullYear()) * 12 + (today.getMonth() - made.getMonth());

  let phase: string;
  let intervalMonths: number;
  let urgency: RecallInfo['urgency'];
  let note: string;

  if (monthsSince < 3) {
    phase = '적응기 (집중 관찰)';
    intervalMonths = 1;
    urgency = 'high';
    note = '점막 적응 시기로 작은 자극에도 상처가 잘 생겨요';
  } else if (monthsSince < 12) {
    phase = '1년차 (급격 흡수기)';
    intervalMonths = 3;
    urgency = 'medium';
    note = '첫 1년은 잇몸뼈 변화가 가장 빨라요. 3개월마다 점검을 권장해요';
  } else if (monthsSince < 60) {
    phase = '안정기 (1-5년)';
    intervalMonths = 6;
    urgency = 'normal';
    note = '6개월마다 정기 점검. 틀니 안쪽을 다시 맞춰야 할 수 있어요';
  } else {
    phase = '장기 사용 (5년 이상)';
    intervalMonths = 6;
    urgency = 'high';
    note = '5년 이상 사용하셨어요. 틀니 교체를 검토할 시기예요';
  }

  const nextRecall = new Date(today);
  nextRecall.setMonth(nextRecall.getMonth() + intervalMonths);
  const dDay = Math.ceil((nextRecall.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return { phase, intervalMonths, monthsSince, nextRecall, dDay, urgency, note };
}
