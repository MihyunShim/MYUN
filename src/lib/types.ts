// DB 테이블과 1:1 대응하는 타입 (db/migrations/001_init.sql 참고)

export interface Profile {
  id: string;
  role: 'A1' | 'A2';
  name: string;
  birth_year: number | null;
  phone: string | null;
  font_size_mode: 'normal' | 'large';
  invite_code: string | null;
}

export interface Routine {
  id: string;
  user_id: string;
  slot: SlotId;
  alarm_time: string; // "07:00:00"
  label: string;
  enabled: boolean;
}

export interface RoutineLog {
  id: string;
  user_id: string;
  slot: SlotId;
  log_date: string; // "2026-07-13"
  done_at: string;
  done_by: 'self' | 'guardian_proxy';
}

export type SlotId = 'A00' | 'A01' | 'A02' | 'A03' | 'A04';

export interface Alert {
  id: string;
  elder_id: string;
  type: 'emergency' | 'missed' | 'recall';
  detail: string | null;
  created_at: string;
  read_at: string | null;
}

// A1 응급 도움 요청 증상 목록 (프로토타입 계승)
export const EMERGENCY_TYPES = [
  { id: 'gum_pain', label: '잇몸이 아파요', icon: '😖' },
  { id: 'denture_loose', label: '틀니가 잘 안 맞아요', icon: '😕' },
  { id: 'denture_broken', label: '틀니가 깨졌거나 잃어버렸어요', icon: '💔' },
] as const;

// 기본 루틴 5종 (프로토타입 v12 계승 — 온보딩에서 시간 수정 가능)
export const DEFAULT_ROUTINES: {
  slot: SlotId;
  time: string;
  label: string;
  action: string;
  tool: string;
}[] = [
  { slot: 'A00', time: '07:00', label: '기상 후', action: '입안과 틀니를 깨끗이 한 뒤 끼우세요', tool: '부드러운 칫솔 · 치과에서 안내한 방법' },
  { slot: 'A01', time: '08:00', label: '아침 식후', action: '식후 틀니를 빼고 음식물을 헹궈내세요', tool: '깨끗한 물 · 뜨거운 물은 피하세요' },
  { slot: 'A02', time: '12:30', label: '점심 식후', action: '식후 틀니를 빼고 음식물을 헹궈내세요', tool: '깨끗한 물 · 뜨거운 물은 피하세요' },
  { slot: 'A03', time: '19:00', label: '저녁 식후', action: '식후 틀니를 빼고 음식물을 헹궈내세요', tool: '깨끗한 물 · 뜨거운 물은 피하세요' },
  { slot: 'A04', time: '22:30', label: '취침 전', action: '틀니를 닦고 빼서 보관하세요', tool: '부드러운 솔 · 틀니용 세정제 · 치과 안내 우선' },
];

export const SLOT_DETAIL: Record<SlotId, { action: string; tool: string }> = Object.fromEntries(
  DEFAULT_ROUTINES.map((r) => [r.slot, { action: r.action, tool: r.tool }]),
) as Record<SlotId, { action: string; tool: string }>;

export { localDateString as todayStr } from './dates';
