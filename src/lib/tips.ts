// 일반적인 가철성 틀니 관리 안내. 개인별 치과 지시와 제품 설명서가 우선합니다.
// 보험 수치·예외 조건은 국내 공식 기준 및 임상 검수 후 별도로 공개합니다.
export interface DailyTip {
  id: string;
  category: '건강보험' | '재제작' | '일반 안내';
  requiresAge65: boolean;
  emoji: string;
  title: string;
  mainMessage: string;
  detailLabel: string;
  detail: string;
  tip: string;
  sourceTitle: string;
  sourceUrl: string;
  reviewedAt: string;
}

const NHS = {
  sourceTitle: 'NHS 틀니 관리 안내 (영문)',
  sourceUrl: 'https://www.nhs.uk/tests-and-treatments/dentures/',
  reviewedAt: '2026-09-11',
};
const ADA = {
  sourceTitle: '미국치과의사협회 틀니 안내 (영문)',
  sourceUrl: 'https://www.mouthhealthy.org/all-topics-a-z/dentures',
  reviewedAt: '2026-09-11',
};

export const DAILY_TIPS: DailyTip[] = [
  {
    id: 'care_brush', category: '일반 안내', requiresAge65: false, emoji: '🪥',
    title: '틀니는 매일 부드럽게 닦아요',
    mainMessage: '부드러운 솔과 틀니에 맞는 세정제로 표면을 닦아주세요.',
    detailLabel: '세정제 선택', detail: '표면을 긁지 않는 제품을 사용해요',
    tip: '맞는 제품과 사용 방법은 치과에 물어보세요.',
    ...ADA,
  },
  {
    id: 'care_after_meals', category: '일반 안내', requiresAge65: false, emoji: '💧',
    title: '식후에는 음식물을 헹궈내요',
    mainMessage: '틀니를 빼고 물로 음식물 찌꺼기를 헹궈주세요.',
    detailLabel: '매일 관리', detail: '헹구기와 별도로 솔질도 해주세요',
    tip: '틀니 표면에 일반 치약을 사용하면 손상될 수 있어요.',
    ...NHS,
  },
  {
    id: 'care_mouth', category: '일반 안내', requiresAge65: false, emoji: '🦷',
    title: '입안도 함께 관리해요',
    mainMessage: '잇몸과 혀를 부드럽게 닦고, 남아 있는 치아도 양치해주세요.',
    detailLabel: '틀니를 끼우기 전', detail: '입안이 아프거나 상처가 있는지도 살펴봐요',
    tip: '아프거나 자극이 계속되면 치과에 알려주세요.',
    ...ADA,
  },
  {
    id: 'care_night', category: '일반 안내', requiresAge65: false, emoji: '🌙',
    title: '잠잘 때는 틀니를 빼요',
    mainMessage: '치과에서 별도로 지시한 경우가 아니라면, 잠잘 때는 틀니를 빼주세요.',
    detailLabel: '개인별 안내 우선', detail: '발치 직후 새 틀니는 치과의 착용 지시를 따라요',
    tip: '보관 방법도 사용 중인 틀니에 맞게 확인해주세요.',
    ...NHS,
  },
  {
    id: 'care_drop', category: '일반 안내', requiresAge65: false, emoji: '🧺',
    title: '떨어뜨리지 않도록 준비해요',
    mainMessage: '틀니를 닦을 때는 아래에 수건을 깔거나 세면대에 물을 받아주세요.',
    detailLabel: '파손 예방', detail: '손에서 미끄러져도 충격을 줄일 수 있어요',
    tip: '깨졌다면 조각을 챙겨 치과에서 수리 가능 여부를 확인하세요.',
    ...NHS,
  },
  {
    id: 'care_fit', category: '일반 안내', requiresAge65: false, emoji: '🩺',
    title: '헐겁거나 아프면 치과에 알려요',
    mainMessage: '틀니가 미끄러지거나 통증이 있으면 치과에서 맞음새를 확인받으세요.',
    detailLabel: '예약일까지 참지 않기', detail: '불편한 증상은 치과에 먼저 문의해요',
    tip: '사용 기간만으로 수리나 교체 여부를 정할 수는 없어요.',
    ...NHS,
  },
  {
    id: 'care_product', category: '일반 안내', requiresAge65: false, emoji: '📖',
    title: '세정제 설명서를 확인해요',
    mainMessage: '세정제와 접착제는 설명서에 적힌 방법으로 사용해주세요.',
    detailLabel: '내 틀니에 맞는 제품', detail: '금속이나 부드러운 안감이 있다면 치과에 확인해요',
    tip: '앱은 틀니 재질을 판별하지 않아요. 제품 선택은 치과에 물어보세요.',
    ...ADA,
  },
  {
    id: 'care_checkup', category: '일반 안내', requiresAge65: false, emoji: '📅',
    title: '다음 검진일은 치과와 정해요',
    mainMessage: '틀니의 맞음새와 입안 상태를 정기적으로 확인받으세요.',
    detailLabel: '나에게 맞는 일정', detail: '담당 치과에서 정한 다음 방문일을 기록해요',
    tip: '앱의 관리 기록만으로 구강 상태가 좋다고 판단할 수는 없어요.',
    ...ADA,
  },
];

// 출생 연도만으로 만 나이 또는 보험 자격을 판정하지 않습니다.
// 현재 팁은 모든 연령에게 제공되는 일반 관리 안내입니다.
export function pickTodayTip(_birthYear: number | null): DailyTip {
  const today = new Date();
  const calendarDay = Math.floor(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000);
  return DAILY_TIPS[calendarDay % DAILY_TIPS.length];
}
