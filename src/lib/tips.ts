// 일일 정보 팝업 풀 (프로토타입 v12의 15개 콘텐츠 계승)
// 건강보험·재제작 정보는 만 65세 이상에게만 표시

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
}

export const DAILY_TIPS: DailyTip[] = [
  // ===== 건강보험 유지관리 (만 65세 이상) =====
  {
    id: 'insurance_relining', category: '건강보험', requiresAge65: true, emoji: '🔧',
    title: '틀니 안쪽을 새로 맞춰드려요',
    mainMessage: '잇몸이 변해서 틀니가 헐겁다면 안쪽을 새로 맞춰드릴 수 있어요.',
    detailLabel: '보험 적용', detail: '1년에 1번 (직접법·간접법 각각)',
    tip: '본인부담 30%로 받으실 수 있어요',
  },
  {
    id: 'insurance_rebasing', category: '건강보험', requiresAge65: true, emoji: '🔨',
    title: '틀니 안쪽 전체 새로 만들기',
    mainMessage: '잇몸이 많이 변하면 틀니 안쪽 전체를 새로 만들어드리는 방법도 있어요.',
    detailLabel: '보험 적용', detail: '1년에 1번 (개상)',
    tip: '치과에서 상태에 맞는 방법을 안내해드려요',
  },
  {
    id: 'insurance_tissue', category: '건강보험', requiresAge65: true, emoji: '💗',
    title: '잇몸에 자극 주는 부분 조정',
    mainMessage: '틀니 모서리가 잇몸을 아프게 하면 부드럽게 다듬어드릴 수 있어요.',
    detailLabel: '보험 적용', detail: '1년에 2번 (조직 조정)',
    tip: '아플 때 참지 말고 치과로 오세요',
  },
  {
    id: 'insurance_tooth_repair', category: '건강보험', requiresAge65: true, emoji: '🦷',
    title: '틀니의 인공 치아 수리',
    mainMessage: '틀니의 이가 깨지거나 빠졌다면 수리받으실 수 있어요.',
    detailLabel: '보험 적용', detail: '1년에 2번 (인공치 수리)',
    tip: '깨진 부분도 버리지 말고 가져오세요',
  },
  {
    id: 'insurance_base_repair', category: '건강보험', requiresAge65: true, emoji: '🪛',
    title: '틀니 본체 수리',
    mainMessage: '틀니의 분홍색 부분(본체)이 깨지거나 금이 갔다면 수리 가능해요.',
    detailLabel: '보험 적용', detail: '1년에 2번 (의치상 수리)',
    tip: '⚠️ 본드로 직접 붙이지 마세요!',
  },
  {
    id: 'insurance_occlusion', category: '건강보험', requiresAge65: true, emoji: '⚙️',
    title: '잘 안 맞는 부분 조정',
    mainMessage: '씹을 때 어색하거나 한쪽만 닿는 느낌이 있으면 조정 받으세요.',
    detailLabel: '보험 적용', detail: '단순 조정 1년에 4번 · 복잡 조정 1년에 1번',
    tip: '조정만으로도 많이 편해질 수 있어요',
  },
  {
    id: 'insurance_clasp', category: '건강보험', requiresAge65: true, emoji: '🔗',
    title: '부분틀니 고정 장치 수리',
    mainMessage: '부분틀니의 클라스프(걸쇠)가 늘어났거나 끊어지면 수리 가능해요.',
    detailLabel: '보험 적용', detail: '단순 수리 1년에 2번 · 복잡 수리 1년에 1번',
    tip: '헐거워졌다 싶으면 빨리 오세요',
  },

  // ===== 새 틀니 재제작 (만 65세 이상) =====
  {
    id: 'remake_gum_change', category: '재제작', requiresAge65: true, emoji: '🩺',
    title: '잇몸 상태가 많이 변했다면',
    mainMessage: '잇몸이 많이 줄거나 변해서 지금 틀니가 도저히 안 맞는다면, 7년이 안 됐어도 새 틀니를 만들 수 있어요.',
    detailLabel: '조건', detail: '의사 소견서 필요 (1회 한정)',
    tip: '치과에서 상태를 정확히 확인 받으세요',
  },
  {
    id: 'remake_partial_to_full', category: '재제작', requiresAge65: true, emoji: '🦷',
    title: '부분틀니 → 완전틀니 전환',
    mainMessage: '부분틀니를 쓰시다가 남은 치아가 모두 빠지면 완전틀니로 바꿀 수 있어요.',
    detailLabel: '조건', detail: '7년이 안 됐어도 가능',
    tip: '치아가 흔들리시면 미리 상담받으세요',
  },
  {
    id: 'remake_disaster', category: '재제작', requiresAge65: true, emoji: '🌊',
    title: '화재·수해로 틀니를 잃었을 때',
    mainMessage: '천재지변(화재·수해)으로 틀니가 분실·파손된 경우에도 다시 만들 수 있어요.',
    detailLabel: '필요 서류', detail: '피해사실확인서 (지자체 발급), 파손 시 의사 소견서 추가',
    tip: '같은 종류 틀니로만 재제작 가능해요',
  },

  // ===== 일반 안내 =====
  {
    id: 'info_7year', category: '일반 안내', requiresAge65: false, emoji: '⏰',
    title: '건강보험 새 틀니는 7년에 1번',
    mainMessage: '건강보험으로 새 틀니를 만드는 건 7년에 1번 가능해요.',
    detailLabel: '기준', detail: '최종 장착일로부터 7년',
    tip: '7년 가까워지면 미리 치과 상담받으세요',
  },
  {
    id: 'info_non_covered', category: '일반 안내', requiresAge65: true, emoji: '✨',
    title: '비급여 틀니도 유지관리는 보험!',
    mainMessage: '비급여(자비)로 만드신 틀니도 만 65세 이상이면 유지관리는 건강보험이 적용돼요.',
    detailLabel: '조건', detail: '같은 종류 틀니인 경우',
    tip: '본인부담 30%로 관리받으실 수 있어요',
  },
  {
    id: 'info_no_glue', category: '일반 안내', requiresAge65: false, emoji: '🚫',
    title: '깨진 틀니에 본드는 절대 안 돼요',
    mainMessage: '틀니가 깨지면 본드나 순간접착제로 절대 붙이지 마세요. 잇몸에 해로워요.',
    detailLabel: '올바른 대처', detail: '깨진 조각도 버리지 말고 치과로 가져오세요',
    tip: '건강보험으로 수리받을 수 있어요 (만 65세+)',
  },
  {
    id: 'info_free_3months', category: '일반 안내', requiresAge65: false, emoji: '🎁',
    title: '처음 3개월은 6번까지 무료!',
    mainMessage: '틀니 만드신 후 3개월 동안은 6번까지 무료로 점검받으실 수 있어요.',
    detailLabel: '비용', detail: '진찰료만 부담 (틀니 만든 그 치과에서만)',
    tip: '불편한 곳 있으면 미루지 말고 가세요',
  },
  {
    id: 'info_temp_denture', category: '일반 안내', requiresAge65: true, emoji: '🦷',
    title: '임시틀니는 유지관리 보험 안 돼요',
    mainMessage: '임시틀니(틀니 만드는 중 임시로 쓰는 것)는 건강보험 유지관리 적용이 안 돼요.',
    detailLabel: '안내', detail: '본 틀니 완성 후부터 유지관리 보험 적용',
    tip: '임시틀니 사용 기간은 짧게 잡혀 있어요',
  },
];

// 오늘의 팁 선택: 나이 조건으로 거른 뒤 날짜 기준으로 돌아가며 표시
export function pickTodayTip(birthYear: number | null): DailyTip {
  const age = birthYear ? new Date().getFullYear() - birthYear : null;
  const pool = DAILY_TIPS.filter((t) => !t.requiresAge65 || (age !== null && age >= 65));
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
  );
  return pool[dayOfYear % pool.length];
}
