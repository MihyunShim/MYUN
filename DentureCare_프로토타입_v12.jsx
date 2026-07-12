import React, { useState, useEffect } from 'react';
import {
  Bell, Check, Clock, AlertTriangle, Phone, Heart, Settings,
  Calendar, TrendingUp, Home, Shield, Volume2, ChevronRight,
  Award, Flame, Activity, Users, X, ArrowLeft, Droplet,
  Moon, Sun, Coffee, Utensils, AlertCircle, UserCircle,
  Building2, Stethoscope, Send, Plus, Filter,
  BarChart3, FileText, ClipboardCheck, MessageCircle, UserPlus,
  Download, Eye, Search, ShieldCheck, Database, Server,
  Zap, Globe, RefreshCw, LogOut, Sparkles, User, MapPin,
  Type, Camera, ChevronLeft, SkipForward, Edit2
} from 'lucide-react';

export default function DentureCareV12() {
  // ===== 액터 (히스토리 기억) =====
  const [actor, setActor] = useState(null);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [showActorSwitch, setShowActorSwitch] = useState(false);

  // ===== 온보딩 마법사 (v5: 환자 등록 5단계) =====
  // 1=환영, 2=기본정보(이름/나이), 3=틀니제작시기, 4=단골치과, 5=보호자(선택), 6=완료
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingData, setOnboardingData] = useState({
    name: '',
    birthYear: '',
    phone: '',
    dentureMadeYear: '',     // 신규: 틀니 제작 연도
    dentureMadeMonth: '',    // 신규: 틀니 제작 월
    dentalClinic: '',
    dentalClinicPhone: '',
    notificationTimes: { wake: '07:00', meal1: '08:00', meal2: '12:30', meal3: '19:00', sleep: '22:30' },
    inviteCode: '',
    permissions: { notification: true, location: false, camera: false },
  });

  // 환자 정보 수정용 확인 다이얼로그
  const [showDentureDateConfirm, setShowDentureDateConfirm] = useState(false);
  const [pendingDentureDate, setPendingDentureDate] = useState(null);

  // 응급 모달 (v7 - 검진 탭 내부에서 호출)
  const [showEmergency, setShowEmergency] = useState(false);

  // 데이터 초기화 확인 다이얼로그 (v8)
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // ===== v11 틀니 제작시기 수정 다이얼로그 =====
  const [showDentureDateEdit, setShowDentureDateEdit] = useState(false);
  const [editYear, setEditYear] = useState('');
  const [editMonth, setEditMonth] = useState('');

  // ===== v12 일일 정보 팝업 시스템 =====
  // 하루 한 번 랜덤으로 보험·정보 팝업 표시
  const [dailyInfoPopup, setDailyInfoPopup] = useState(null);
  const [infoPopupShownDate, setInfoPopupShownDate] = useState(null);

  // ===== v12.1 글씨 크기 조절 =====
  // fontSizeMode: 'small'(-3) | 'normal'(0) | 'large'(+3)
  const [fontSizeMode, setFontSizeMode] = useState('normal');
  const fontScale = fontSizeMode === 'small' ? -3 : fontSizeMode === 'large' ? 3 : 0;
  const [showFontSizeDialog, setShowFontSizeDialog] = useState(false);
  // ===== v12.2 루틴 시간 편집 =====
  const [showRoutineTimeDialog, setShowRoutineTimeDialog] = useState(false);
  // 시간 선택 팝업 (액션 상세 화면에서 시간 버튼 누르면)
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerHour, setPickerHour] = useState(7);
  const [pickerMinute, setPickerMinute] = useState(0);

  // ===== v9 리콜 임박 팝업 알람 시스템 =====
  // recallPopup: null이면 안 보임, 객체면 단계 정보
  const [recallPopup, setRecallPopup] = useState(null);
  // 오늘 그만 보기로 처리한 날짜 (YYYY-MM-DD)
  const [popupDismissedToday, setPopupDismissedToday] = useState(null);
  // 마지막 검진 일자 (다녀왔어요 응답 시 업데이트)
  const [lastCheckupDate, setLastCheckupDate] = useState(null);
  // 후속 팝업 표시 여부 (D+1 이후 "다녀오셨어요?")
  const [showPostCheckup, setShowPostCheckup] = useState(false);

  // ===== v10 통합 알람 시스템 (응급 + 미수행) =====
  // generalAlert: { type, title, message, ... } 또는 null
  const [generalAlert, setGeneralAlert] = useState(null);
  // 자가 보고 메뉴 (홈에서 진입)
  const [showReportMenu, setShowReportMenu] = useState(false);
  // 미수행 알람 자동 트리거 (테스트용 시뮬레이션 일수)
  const [simulatedMissedDays, setSimulatedMissedDays] = useState(0);

  // ===== 단골 치과 더미 데이터 (v5) =====
  // 진료팀장님 치과를 메인으로
  const dentalClinics = [
    { id: 1, name: '가디언즈치과', region: '충남 당진', phone: '041-352-7518', distance: '내 단골', primary: true },
    { id: 2, name: '서울치과', region: '서울 강남구', phone: '02-555-0001', distance: '12km' },
    { id: 3, name: '미소치과', region: '서울 강남구', phone: '02-555-0002', distance: '15km' },
    { id: 4, name: '○○대학교 치과병원', region: '서울 종로구', phone: '02-555-0003', distance: '20km' },
  ];

  // ===== 리콜 주기 계산 엔진 (v5 핵심 신규) =====
  // 논문 근거:
  //   - Tallgren (1972): 의치 사용자 7년간 하악 6.6mm 골 흡수 (상악의 4배)
  //   - 1년차 RRR이 가장 큼, 발치 후 첫 몇 달 가장 급격
  //   - Atwood (1971): RRR은 주요 구강 질환
  //   - ACP/ADA: 의치 5년+ 사용 시 연조직 병변 ↑
  //   - 리라이닝(틀니 안쪽 다시 맞춤) 권장: 1~2년마다
  const calculateRecall = (madeYear, madeMonth) => {
    if (!madeYear || !madeMonth) return null;
    const made = new Date(parseInt(madeYear), parseInt(madeMonth) - 1, 1);
    const today = new Date();
    const monthsSince = (today.getFullYear() - made.getFullYear()) * 12 + (today.getMonth() - made.getMonth());

    let phase, intervalMonths, nextRecall, urgency, note;
    if (monthsSince < 3) {
      phase = '적응기 (집중 관찰)';
      intervalMonths = 1;
      urgency = 'high';
      note = '점막 적응 시기로 작은 자극에도 외상성 궤양이 잘 생겨요';
    } else if (monthsSince < 12) {
      phase = '1년차 (급격 흡수기)';
      intervalMonths = 3;
      urgency = 'medium';
      note = '1년차에 골 흡수가 가장 빨라요 (Tallgren 1972). 3개월마다 점검 권장';
    } else if (monthsSince < 60) {
      phase = '안정기 (1-5년)';
      intervalMonths = 6;
      urgency = 'normal';
      note = '6개월마다 정기 점검. 1~2년차에 틀니 안쪽을 다시 맞춰야 할 수 있어요';
    } else {
      phase = '장기 사용 (5년 이상)';
      intervalMonths = 6;
      urgency = 'high';
      note = '5년 이상 사용 시 의치 부적합·연조직 병변 위험 ↑. 의치 교체 검토 시기';
    }

    nextRecall = new Date(today);
    nextRecall.setMonth(nextRecall.getMonth() + intervalMonths);
    const dDay = Math.ceil((nextRecall - today) / (1000 * 60 * 60 * 24));

    return {
      phase, intervalMonths, monthsSince,
      nextRecall, dDay, urgency, note,
      nextRecallStr: `${nextRecall.getFullYear()}년 ${nextRecall.getMonth()+1}월 ${nextRecall.getDate()}일`,
    };
  };

  // 등록된 환자의 리콜 정보 계산
  const recallInfo = onboardingData.dentureMadeYear && onboardingData.dentureMadeMonth
    ? calculateRecall(onboardingData.dentureMadeYear, onboardingData.dentureMadeMonth)
    : null;


  // ===== v10 알람 정의 (응급 + 미수행) =====
  const alertDefinitions = {
    // 응급 알람 (자가 보고)
    gum_pain: {
      icon: '💗', emoji: '😣',
      title: '잇몸이 아프시나요?',
      color: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5',
      message: '잇몸이 아프거나 헐어있다면 참지 마시고 치과로 오세요.',
      warnings: [
        '뜨거운 물로 헹구지 마세요',
        '아픈 채로 계속 사용하지 마세요',
        '약국 약으로만 버티지 마세요',
      ],
      tip: '빨리 보면 빨리 좋아져요',
      primaryButton: '지금 전화하기',
      severity: 'high',
    },
    denture_broken: {
      icon: '🦷', emoji: '💔',
      title: '틀니가 깨졌다면 본드는 절대 안 돼요',
      color: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5',
      message: '틀니가 부러지거나 금이 갔다면 꼭 치과로 가져오세요.',
      warnings: [
        '본드로 붙이지 마세요 (잇몸에 해로워요)',
        '순간접착제 사용하지 마세요',
        '직접 갈거나 다듬지 마세요',
      ],
      tip: '깨진 조각도 버리지 말고 같이 가져오세요. 수리가 가능할 수 있어요',
      primaryButton: '지금 전화하기',
      severity: 'high',
    },
    denture_loose: {
      icon: '🦷', emoji: '😕',
      title: '틀니가 헐겁거나 아프신가요?',
      color: '#EA580C', bg: '#FFF7ED', border: '#FB923C',
      message: '틀니가 잘 안 맞으면 불편함을 참지 마세요.',
      warnings: [
        '억지로 끼우지 마세요',
        '음식 씹으며 적응하려 하지 마세요',
      ],
      tip: '안쪽을 다시 맞춰드리는 시술이 보험 적용돼요. 1년에 2번까지 받으실 수 있어요',
      primaryButton: '예약 전화하기',
      severity: 'medium',
    },

    // 미수행 알람 (자동 트리거)
    missed_1day: {
      icon: '🔔', emoji: '⏰',
      title: '오늘 아직 틀니를 안 닦으셨어요',
      color: '#D97706', bg: '#FFFBEB', border: '#FCD34D',
      message: '오늘은 아직 틀니 청소 기록이 없어요.\n지금이라도 닦으시는 게 좋아요.',
      tip: '식후 1분 솔질이면 충분해요',
      primaryButton: '지금 닦았어요',
      severity: 'low',
    },
    missed_3days: {
      icon: '💙', emoji: '😟',
      title: '걱정이 돼서 연락드려요',
      color: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5',
      message: '3일째 틀니 청소 기록이 없네요.\n혹시 불편하신 곳이 있으세요?',
      tip: '잇몸 통증이나 틀니가 잘 안 맞으시면 치과로 연락주세요',
      primaryButton: '괜찮아요, 다시 시작할게요',
      secondaryButton: '치과 예약',
      severity: 'high',
    },
    sleep_with_denture: {
      icon: '🌙', emoji: '😴',
      title: '주무시기 전에 틀니 빼셨어요?',
      color: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD',
      message: '주무실 때는 틀니를 빼서 물에 담가두세요.',
      warnings: [
        '잠잘 때 계속 끼고 계시면 잇몸이 쉬지 못해요',
        '잇몸 염증 위험이 늘어요',
      ],
      tip: '시원한 물 한 컵에 담그면 끝!',
      primaryButton: '지금 뺐어요',
      secondaryButton: '오늘은 끼고 잘게요',
      severity: 'medium',
    },
  };

  // 자가 보고 메뉴에서 선택할 수 있는 항목들
  const reportableAlerts = [
    { id: 'gum_pain', label: '잇몸이 아파요', icon: '💗', color: '#DC2626' },
    { id: 'denture_broken', label: '틀니가 깨졌어요', icon: '🦷', color: '#DC2626' },
    { id: 'denture_loose', label: '틀니가 잘 안 맞아요', icon: '😕', color: '#EA580C' },
  ];

  // ===== 화면 상태 =====
  const [screen, setScreen] = useState('home');
  const [activeAction, setActiveAction] = useState(null);
  const [selectedElder, setSelectedElder] = useState(null);
  const [a3Filter, setA3Filter] = useState('all');

  // 액터 변경 시 화면 초기화
  useEffect(() => {
    setScreen('home');
    setSelectedElder(null);
    setActiveAction(null);
  }, [actor]);


  // ===== A1 데이터 =====
  const [todayActions, setTodayActions] = useState([
    { id: 'A00', time: '07:00', label: '기상 후', icon: Sun, action: '입을 헹구고 틀니를 끼우세요', tool: '미온수', duration: 30, done: false, doneBy: null },
    { id: 'A01', time: '08:00', label: '아침 식후', icon: Coffee, action: '지금 주방세제로 1분간 솔질하세요', tool: '주방세제 (연마제 X)', duration: 60, done: false, doneBy: null },
    { id: 'A02', time: '12:30', label: '점심 식후', icon: Utensils, action: '지금 주방세제로 1분간 솔질하세요', tool: '주방세제 (연마제 X)', duration: 60, done: false, doneBy: null },
    { id: 'A03', time: '19:00', label: '저녁 식후', icon: Utensils, action: '지금 주방세제로 1분간 솔질하세요', tool: '주방세제 (연마제 X)', duration: 60, done: false, doneBy: null },
    { id: 'A04', time: '22:30', label: '취침 전', icon: Moon, action: '잠자기 전, 틀니를 찬물 통에 담그세요', tool: '찬물 (≤25℃) · 완전 침수', duration: 30, done: false, doneBy: null },
  ]);
  const [streak, setStreak] = useState(0);
  const [automaticity, setAutomaticity] = useState(0);
  const phase = streak < 30 ? 1 : streak < 90 ? 2 : 3;
  const completedToday = todayActions.filter(a => a.done).length;
  const totalToday = todayActions.length;

  // ===== 데이터 저장/불러오기 (v8 신규) =====
  // Claude Artifacts의 영구 저장소(window.storage) 사용
  // 앱을 닫았다 다시 열어도 데이터 유지됨
  const STORAGE_KEY = 'denturecare:user-data';
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastSaved, setLastSaved] = useState(null); // 마지막 저장 시각

  // 앱 시작 시 저장된 데이터 불러오기
  useEffect(() => {
    const loadData = async () => {
      try {
        if (typeof window !== 'undefined' && window.storage) {
          const result = await window.storage.get(STORAGE_KEY);
          if (result && result.value) {
            const saved = JSON.parse(result.value);
            if (saved.onboardingData) setOnboardingData(saved.onboardingData);
            if (saved.actor) setActor(saved.actor);
            if (saved.hasOnboarded !== undefined) setHasOnboarded(saved.hasOnboarded);
            if (saved.streak !== undefined) setStreak(saved.streak);
            if (saved.automaticity !== undefined) setAutomaticity(saved.automaticity);
            if (saved.fontSizeMode) setFontSizeMode(saved.fontSizeMode);
            // todayActions의 'done' 상태만 복원 (icon 컴포넌트는 함수라 직렬화 불가)
            // 단, 저장된 날짜가 '오늘'일 때만 복원. 다른 날이면 새 하루이므로 초기화
            const savedDateStr = saved.savedAt ? new Date(saved.savedAt).toISOString().split('T')[0] : null;
            const todayStr = new Date().toISOString().split('T')[0];
            const isSameDay = savedDateStr === todayStr;

            if (isSameDay && saved.todayActionsDoneState && Array.isArray(saved.todayActionsDoneState)) {
              // 오늘 저장한 데이터 → 체크 상태 + 시간 복원
              setTodayActions(prev => prev.map((a, i) => ({
                ...a,
                done: saved.todayActionsDoneState[i]?.done ?? a.done,
                doneBy: saved.todayActionsDoneState[i]?.doneBy ?? a.doneBy,
                time: saved.todayActionsDoneState[i]?.time ?? a.time,
              })));
            } else {
              // 다른 날(어제 등) → 체크는 초기화하되, 설정한 시간은 유지
              setTodayActions(prev => prev.map((a, i) => ({
                ...a,
                done: false,
                doneBy: null,
                time: saved.todayActionsDoneState?.[i]?.time ?? a.time,
              })));
            }
            if (saved.savedAt) setLastSaved(new Date(saved.savedAt));
          }
        }
      } catch (err) {
        // 저장 데이터 없거나 손상된 경우 - 무시하고 새로 시작
      } finally {
        setIsLoaded(true);
      }
    };
    loadData();
  }, []); // 앱 시작 시 한 번만

  // 데이터 저장 함수 (필요할 때 명시적으로 호출)
  const saveData = async () => {
    try {
      if (typeof window !== 'undefined' && window.storage) {
        const now = new Date().toISOString();
        // todayActions의 done/doneBy/time 상태만 추출 (icon은 함수라 직렬화 불가)
        const todayActionsDoneState = todayActions.map(a => ({
          id: a.id, done: a.done, doneBy: a.doneBy, time: a.time,
        }));
        const dataToSave = {
          onboardingData,
          actor,
          hasOnboarded,
          streak,
          automaticity,
          fontSizeMode,
          todayActionsDoneState,
          savedAt: now,
        };
        await window.storage.set(STORAGE_KEY, JSON.stringify(dataToSave));
        setLastSaved(new Date(now));
        return true;
      }
    } catch (err) {
      // 저장 실패해도 앱 동작에는 영향 없도록 조용히 처리
    }
    return false;
  };

  // 데이터 삭제 함수 (초기화용)
  const clearData = async () => {
    try {
      if (typeof window !== 'undefined' && window.storage) {
        await window.storage.delete(STORAGE_KEY);
        setLastSaved(null);
        return true;
      }
    } catch (err) {
      // 삭제 실패해도 조용히 처리
    }
    return false;
  };

  // 환자 정보 변경 시 자동 저장
  useEffect(() => {
    if (!isLoaded) return; // 초기 로딩 중에는 저장 안 함
    if (!hasOnboarded) return; // 온보딩 완료 전엔 저장 안 함
    saveData();
  }, [onboardingData, actor, hasOnboarded, streak, automaticity, fontSizeMode]);

  // ===== v9 팝업 자동 트리거 (검진 임박 시) =====
  // D-14, D-7, D-3, D-day, D+1~+3 각각 다른 메시지
  // 하루 한 번만 표시 (오늘 그만 보기 처리됨)
  useEffect(() => {
    if (!recallInfo || !hasOnboarded || onboardingStep > 0) return;
    if (!isLoaded) return; // 로딩 중에는 띄우지 않음

    const todayStr = new Date().toISOString().split('T')[0];
    if (popupDismissedToday === todayStr) return; // 오늘 그만 보기 처리됨

    // 이미 검진 팝업이 떠 있으면 다시 띄우지 않음 (중복 방지)
    if (recallPopup) return;

    const dDay = recallInfo.dDay;
    let stage = null;

    // D+1 ~ D+3: 후속 팝업 (다녀오셨어요?)
    if (dDay < 0 && dDay >= -3 && !lastCheckupDate) {
      stage = 'after';
    }
    // D-day
    else if (dDay === 0) {
      stage = 'd_day';
    }
    // D-3 ~ D-1
    else if (dDay > 0 && dDay <= 3) {
      stage = 'd_3';
    }
    // D-4 ~ D-7
    else if (dDay > 3 && dDay <= 7) {
      stage = 'd_7';
    }
    // D-8 ~ D-14
    else if (dDay > 7 && dDay <= 14) {
      stage = 'd_14';
    }

    if (stage) {
      // 1초 뒤에 팝업 (홈 진입 직후 자연스럽게)
      const timer = setTimeout(() => setRecallPopup({ stage, dDay }), 1000);
      return () => clearTimeout(timer);
    }
  }, [recallInfo, hasOnboarded, onboardingStep, isLoaded, popupDismissedToday, lastCheckupDate, recallPopup]);

  // ===== v12 일일 정보 팝업 풀 (15개) =====
  // 만 65세 이상 환자만 보험 관련 팝업 표시
  // 모든 환자에게 공통: 일반 안내 (3개)
  const allInfoPopups = [
    // ===== 건강보험 유지관리 (만 65세 이상만) - 7개 =====
    {
      id: 'insurance_relining',
      category: '건강보험',
      requiresAge65: true,
      icon: '💙', emoji: '🔧',
      title: '틀니 안쪽을 새로 맞춰드려요',
      color: '#1E40AF', bg: '#DBEAFE', border: '#93C5FD',
      mainMessage: '잇몸이 변해서 틀니가 헐겁다면\n안쪽을 새로 맞춰드릴 수 있어요.',
      detailLabel: '보험 적용',
      detail: '1년에 1번 (직접법·간접법 각각)',
      tip: '본인부담 30%로 받으실 수 있어요',
    },
    {
      id: 'insurance_rebasing',
      category: '건강보험',
      requiresAge65: true,
      icon: '💙', emoji: '🔨',
      title: '틀니 안쪽 전체 새로 만들기',
      color: '#1E40AF', bg: '#DBEAFE', border: '#93C5FD',
      mainMessage: '잇몸이 많이 변하면 틀니 안쪽 전체를\n새로 만들어드리는 방법도 있어요.',
      detailLabel: '보험 적용',
      detail: '1년에 1번 (개상, rebasing)',
      tip: '치과에서 상태에 맞는 방법을 안내해드려요',
    },
    {
      id: 'insurance_tissue',
      category: '건강보험',
      requiresAge65: true,
      icon: '💙', emoji: '💗',
      title: '잇몸에 자극 주는 부분 조정',
      color: '#1E40AF', bg: '#DBEAFE', border: '#93C5FD',
      mainMessage: '틀니 모서리가 잇몸을 아프게 하면\n부드럽게 다듬어드릴 수 있어요.',
      detailLabel: '보험 적용',
      detail: '1년에 2번 (조직 조정)',
      tip: '아플 때 참지 말고 치과로 오세요',
    },
    {
      id: 'insurance_tooth_repair',
      category: '건강보험',
      requiresAge65: true,
      icon: '💙', emoji: '🦷',
      title: '틀니의 인공 치아 수리',
      color: '#1E40AF', bg: '#DBEAFE', border: '#93C5FD',
      mainMessage: '틀니의 이가 깨지거나 빠졌다면\n수리받으실 수 있어요.',
      detailLabel: '보험 적용',
      detail: '1년에 2번 (인공치 수리)',
      tip: '깨진 부분도 버리지 말고 가져오세요',
    },
    {
      id: 'insurance_base_repair',
      category: '건강보험',
      requiresAge65: true,
      icon: '💙', emoji: '🪛',
      title: '틀니 본체 수리',
      color: '#1E40AF', bg: '#DBEAFE', border: '#93C5FD',
      mainMessage: '틀니의 분홍색 부분(본체)이 깨지거나\n금이 갔다면 수리 가능해요.',
      detailLabel: '보험 적용',
      detail: '1년에 2번 (의치상 수리)',
      tip: '⚠️ 본드로 직접 붙이지 마세요!',
    },
    {
      id: 'insurance_occlusion',
      category: '건강보험',
      requiresAge65: true,
      icon: '💙', emoji: '⚙️',
      title: '잘 안 맞는 부분 조정',
      color: '#1E40AF', bg: '#DBEAFE', border: '#93C5FD',
      mainMessage: '씹을 때 어색하거나 한쪽만\n닿는 느낌이 있으면 조정 받으세요.',
      detailLabel: '보험 적용',
      detail: '단순 조정 1년에 4번\n복잡 조정 1년에 1번',
      tip: '조정만으로도 많이 편해질 수 있어요',
    },
    {
      id: 'insurance_clasp',
      category: '건강보험',
      requiresAge65: true,
      icon: '💙', emoji: '🔗',
      title: '부분틀니 고정 장치 수리',
      color: '#1E40AF', bg: '#DBEAFE', border: '#93C5FD',
      mainMessage: '부분틀니의 클라스프(걸쇠)가\n늘어났거나 끊어지면 수리 가능해요.',
      detailLabel: '보험 적용',
      detail: '단순 수리 1년에 2번\n복잡 수리 1년에 1번',
      tip: '헐거워졌다 싶으면 빨리 오세요',
    },

    // ===== 새 틀니 만들 수 있는 경우 (만 65세 이상만) - 3개 =====
    {
      id: 'remake_gum_change',
      category: '재제작',
      requiresAge65: true,
      icon: '🔄', emoji: '🩺',
      title: '잇몸 상태가 많이 변했다면',
      color: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD',
      mainMessage: '잇몸이 많이 줄거나 변해서\n지금 틀니가 도저히 안 맞는다면\n7년이 안 됐어도 새 틀니 만들 수 있어요.',
      detailLabel: '조건',
      detail: '의사 소견서가 필요해요\n(1회 한정)',
      tip: '치과에서 상태를 정확히 확인 받으세요',
    },
    {
      id: 'remake_partial_to_full',
      category: '재제작',
      requiresAge65: true,
      icon: '🔄', emoji: '🦷',
      title: '부분틀니 → 완전틀니 전환',
      color: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD',
      mainMessage: '부분틀니를 쓰시다가\n남은 치아가 모두 빠지면\n완전틀니로 바꿀 수 있어요.',
      detailLabel: '조건',
      detail: '7년이 안 됐어도 가능\n(부분틀니 제작기간 무관)',
      tip: '치아가 흔들리시면 미리 상담받으세요',
    },
    {
      id: 'remake_disaster',
      category: '재제작',
      requiresAge65: true,
      icon: '🔄', emoji: '🌊',
      title: '화재·수해로 틀니 잃었을 때',
      color: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD',
      mainMessage: '천재지변(화재·수해)으로\n틀니가 분실되거나 파손된 경우에도\n다시 만들 수 있어요.',
      detailLabel: '필요 서류',
      detail: '피해사실확인서 (지자체 발급)\n파손 시 의사 소견서 추가',
      tip: '같은 종류 틀니로만 재제작 가능해요',
    },

    // ===== 일반 안내 (모든 환자) - 5개 =====
    {
      id: 'info_7year',
      category: '일반 안내',
      requiresAge65: false,
      icon: '📅', emoji: '⏰',
      title: '건강보험 새 틀니는 7년에 1번',
      color: '#0891B2', bg: '#CFFAFE', border: '#67E8F9',
      mainMessage: '건강보험으로 새 틀니를 만드는 건\n7년에 1번 가능해요.',
      detailLabel: '기준',
      detail: '최종 장착일로부터 7년',
      tip: '7년 가까워지면 미리 치과 상담받으세요',
    },
    {
      id: 'info_non_covered',
      category: '일반 안내',
      requiresAge65: true,
      icon: '💡', emoji: '✨',
      title: '비급여 틀니도 유지관리는 보험!',
      color: '#0891B2', bg: '#CFFAFE', border: '#67E8F9',
      mainMessage: '비급여(자비)로 만드신 틀니도\n만 65세 이상이면\n유지관리는 건강보험 적용돼요.',
      detailLabel: '조건',
      detail: '같은 종류 틀니인 경우\n(레진상·금속상 완전틀니, 부분틀니)',
      tip: '본인부담 30%로 관리받으실 수 있어요',
    },
    {
      id: 'info_no_glue',
      category: '일반 안내',
      requiresAge65: false,
      icon: '⚠️', emoji: '🚫',
      title: '깨진 틀니에 본드는 절대 안 돼요',
      color: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5',
      mainMessage: '틀니가 깨지면\n본드나 순간접착제로 절대 붙이지 마세요.\n잇몸에 해로워요.',
      detailLabel: '올바른 대처',
      detail: '깨진 조각도 버리지 말고\n치과로 가져오세요',
      tip: '건강보험으로 수리받을 수 있어요 (만 65세+)',
    },
    {
      id: 'info_free_3months',
      category: '일반 안내',
      requiresAge65: false,
      icon: '💚', emoji: '🎁',
      title: '처음 3개월은 6번까지 무료!',
      color: '#15803D', bg: '#DCFCE7', border: '#86EFAC',
      mainMessage: '틀니 만드신 후 3개월 동안은\n6번까지 무료로 점검받으실 수 있어요.',
      detailLabel: '비용',
      detail: '진찰료만 부담\n(틀니 만든 그 치과에서만)',
      tip: '불편한 곳 있으면 미루지 말고 가세요',
    },
    {
      id: 'info_temp_denture',
      category: '일반 안내',
      requiresAge65: true,
      icon: '💡', emoji: '🦷',
      title: '임시틀니는 유지관리 보험 안 돼요',
      color: '#0891B2', bg: '#CFFAFE', border: '#67E8F9',
      mainMessage: '임시틀니(틀니 만드는 중 임시로 쓰는 것)는\n건강보험 유지관리 적용이 안 돼요.',
      detailLabel: '안내',
      detail: '본 틀니가 완성된 후부터\n유지관리 보험 적용됩니다',
      tip: '임시틀니 사용 기간은 짧게 잡혀 있어요',
    },
  ];

  // ===== v12 일일 정보 팝업 자동 트리거 =====
  useEffect(() => {
    if (!hasOnboarded || onboardingStep > 0) return;
    if (!isLoaded) return;

    const todayStr = new Date().toISOString().split('T')[0];
    if (infoPopupShownDate === todayStr) return; // 오늘 이미 봤음

    // 이미 정보 팝업이 떠 있으면 또 띄우지 않음 (중복 방지)
    if (dailyInfoPopup) return;

    // 검진 팝업이 떠 있으면 정보 팝업 안 띄움 (검진 우선)
    if (recallPopup) return;

    // 검진 임박(D-14 이내)이면 검진 팝업이 우선, 정보 팝업 안 띄움
    if (recallInfo && recallInfo.dDay >= -3 && recallInfo.dDay <= 14) return;

    // 환자 연령 확인
    const age = onboardingData.birthYear
      ? new Date().getFullYear() - parseInt(onboardingData.birthYear)
      : 0;
    const is65Plus = age >= 65;

    // 연령에 맞는 팝업만 필터링
    const availablePopups = allInfoPopups.filter(p => !p.requiresAge65 || is65Plus);
    if (availablePopups.length === 0) return;

    // 랜덤으로 하나 선택
    const randomIdx = Math.floor(Math.random() * availablePopups.length);
    const selected = availablePopups[randomIdx];

    // 먼저 오늘 봤다고 기록 → 중복 트리거 차단
    setInfoPopupShownDate(todayStr);

    // 2.5초 뒤에 팝업 (검진 팝업과 겹치지 않게)
    const timer = setTimeout(() => {
      // 타이머 실행 시점에 검진 팝업이 떠 있으면 띄우지 않음
      setRecallPopup((currentRecall) => {
        if (!currentRecall) {
          setDailyInfoPopup(selected);
        }
        return currentRecall; // 검진 팝업 상태는 그대로 유지
      });
    }, 2500);
    return () => clearTimeout(timer);
  }, [hasOnboarded, onboardingStep, isLoaded, infoPopupShownDate, recallInfo, onboardingData.birthYear, dailyInfoPopup, recallPopup]);

  const weekData = [
    { day: '월', completed: 5, total: 5 }, { day: '화', completed: 4, total: 5 },
    { day: '수', completed: 5, total: 5 }, { day: '목', completed: 5, total: 5 },
    { day: '금', completed: 3, total: 5 }, { day: '토', completed: 5, total: 5 },
    { day: '일', completed: 2, total: 5 },
  ];

  // ===== A3 시설 데이터 =====
  const facility = { name: '○○요양원', totalElders: 12, totalCaregivers: 8 };
  const elders = [
    { id: 1, name: '김순자', age: 78, room: '201호', completed: 5, total: 5, automaticity: 0.42, emergency: false, lastActivity: '5분 전', phase: 1 },
    { id: 2, name: '박영희', age: 82, room: '202호', completed: 3, total: 5, automaticity: 0.28, emergency: false, lastActivity: '40분 전', phase: 1 },
    { id: 3, name: '이만수', age: 75, room: '203호', completed: 5, total: 5, automaticity: 0.55, emergency: false, lastActivity: '12분 전', phase: 2 },
    { id: 4, name: '정점례', age: 87, room: '205호', completed: 1, total: 5, automaticity: 0.15, emergency: true, lastActivity: '2시간 전', phase: 1, emergencyType: '잇몸 통증' },
    { id: 5, name: '최순옥', age: 79, room: '206호', completed: 4, total: 5, automaticity: 0.48, emergency: false, lastActivity: '20분 전', phase: 1 },
    { id: 6, name: '한복순', age: 84, room: '207호', completed: 2, total: 5, automaticity: 0.32, emergency: false, lastActivity: '1시간 전', phase: 1 },
    { id: 7, name: '강명자', age: 76, room: '301호', completed: 5, total: 5, automaticity: 0.61, emergency: false, lastActivity: '8분 전', phase: 2 },
    { id: 8, name: '윤병호', age: 81, room: '302호', completed: 4, total: 5, automaticity: 0.44, emergency: false, lastActivity: '30분 전', phase: 1 },
  ];

  // ===== A2 가족 데이터 =====
  const familyData = {
    caregiverName: '김미선', elderName: '김순자', elderAge: 78, relation: '어머니',
    todayCompleted: 3, todayTotal: 5, weekRate: 0.83, streak: 23,
    automaticity: 0.42, lastActivity: '오늘 12:30 점심 후 양치 완료',
  };

  // ===== A5 시스템 관리자 데이터 (신규) =====
  const adminStats = {
    totalUsers: 3847, totalElders: 1284, totalFamilies: 1923, totalCaregivers: 612, totalDental: 28,
    activeFacilities: 47, todayDAU: 2691, todayResponseRate: 78.4,
    monthlyEmergencies: 89, avgAutomaticity: 0.38,
    growthRate: 12.3, // %
  };
  const facilityRanking = [
    { id: 1, name: '○○요양원', region: '서울 강남', elders: 12, responseRate: 92, avgAutomaticity: 0.51 },
    { id: 2, name: '△△실버케어', region: '경기 분당', elders: 28, responseRate: 88, avgAutomaticity: 0.47 },
    { id: 3, name: '□□요양센터', region: '서울 강북', elders: 22, responseRate: 84, avgAutomaticity: 0.44 },
    { id: 4, name: '◇◇재가복지', region: '인천 남동', elders: 18, responseRate: 79, avgAutomaticity: 0.41 },
    { id: 5, name: '◎◎노인의 집', region: '부산 해운대', elders: 15, responseRate: 76, avgAutomaticity: 0.39 },
  ];

  // ===== 디자인 토큰 =====
  const colors = {
    bg: '#FAF7F2', surface: '#FFFFFF',
    primary: '#1E5F74', primaryLight: '#E6F0F2',
    accent: '#D97706', danger: '#B91C1C',
    success: '#15803D', warning: '#CA8A04',
    text: '#1F2937', textSub: '#4B5563', border: '#E5E7EB',
    a1Color: '#1E5F74', a2Color: '#9F1239',
    a3Color: '#166534', a5Color: '#4338CA', // 관리자 - 인디고
  };

  const baseStyle = {
    fontFamily: '"Noto Sans KR", "맑은 고딕", system-ui, sans-serif',
    color: colors.text, fontSize: `${19 + fontScale}px`, lineHeight: 1.5,
  };

  // 액션 완료
  const handleComplete = (id) => {
    setTodayActions(prev => prev.map(a => a.id === id ? { ...a, done: true, doneBy: actor === 'A3' ? 'caregiver_proxy' : 'self' } : a));
    if (actor !== 'A3') setAutomaticity(prev => Math.min(1, prev + 0.02));
    setScreen(actor === 'A3' ? 'elderDetail' : 'home');
    setActiveAction(null);
  };

  // v12.2: 완료 취소 (실수로 체크했을 때 되돌리기)
  const handleUncomplete = (id) => {
    setTodayActions(prev => prev.map(a => a.id === id ? { ...a, done: false, doneBy: null } : a));
    if (actor !== 'A3') setAutomaticity(prev => Math.max(0, prev - 0.02));
    setScreen(actor === 'A3' ? 'elderDetail' : 'home');
    setActiveAction(null);
  };

  // v12.3: 음성으로 읽어주기 (Web Speech API)
  const speakText = (text) => {
    try {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        alert('이 기기에서는 음성 기능을 지원하지 않아요.');
        return;
      }
      // 이전 음성이 재생 중이면 멈춤
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';      // 한국어
      utterance.rate = 0.85;          // 조금 천천히 (노인 배려)
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // 한국어 음성이 있으면 우선 선택
      const voices = window.speechSynthesis.getVoices();
      const koVoice = voices.find(v => v.lang === 'ko-KR' || v.lang.startsWith('ko'));
      if (koVoice) utterance.voice = koVoice;

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      alert('음성 재생 중 문제가 생겼어요.');
    }
  };

  // 액터 선택 처리 (첫 진입 시 온보딩 시작)
  const selectActor = (id) => {
    setActor(id);
    setShowActorSwitch(false);
    // 처음 사용자(아직 온보딩 안 된)는 온보딩 마법사로
    if (!hasOnboarded && id === 'A1') {
      setOnboardingStep(1);
    } else {
      setHasOnboarded(true);
    }
  };

  // 온보딩 단계 이동
  const nextOnboardingStep = () => {
    if (onboardingStep < 6) setOnboardingStep(onboardingStep + 1);
    else {
      setOnboardingStep(0);
      setHasOnboarded(true);
      // 새 환자 등록 완료 → 오늘의 할 일 깨끗하게 초기화
      setTodayActions(prev => prev.map(a => ({ ...a, done: false, doneBy: null })));
      setStreak(0);
      // 온보딩 완료 시 즉시 저장 (다음 useEffect로 자동 저장되지만 안전망)
      setTimeout(() => saveData(), 100);
    }
  };
  const prevOnboardingStep = () => {
    if (onboardingStep > 1) setOnboardingStep(onboardingStep - 1);
  };
  const skipOnboarding = () => {
    setOnboardingStep(0);
    setHasOnboarded(true);
    // 새 환자 등록 완료 → 오늘의 할 일 깨끗하게 초기화
    setTodayActions(prev => prev.map(a => ({ ...a, done: false, doneBy: null })));
    setStreak(0);
    setTimeout(() => saveData(), 100);
  };

  // ===========================================
  // ============ 0. 액터 선택 화면 ===============
  // ===========================================
  const renderActorSelect = ({ isSwitch = false }) => (
    <div style={{
      background: `linear-gradient(135deg, #1E5F74 0%, #0F3B47 100%)`,
      minHeight: '100%', padding: '40px 20px',
      display: 'flex', flexDirection: 'column', color: '#fff',
    }}>
      <div style={{ marginTop: 20, marginBottom: 30 }}>
        <p style={{ fontSize: (17 + fontScale), opacity: 0.7, margin: 0, letterSpacing: '0.1em' }}>DENTURECARE v3.0</p>
        <h1 style={{ fontSize: (34 + fontScale), fontWeight: 800, margin: '6px 0 8px', letterSpacing: '-0.02em' }}>
          {isSwitch ? '역할 변경' : '어떻게 사용하시나요?'}
        </h1>
        <p style={{ fontSize: (18 + fontScale), opacity: 0.75, margin: 0, lineHeight: 1.5 }}>
          {isSwitch ? '다른 역할로 전환합니다' : '한 번 선택하면 다음부터 자동으로 진입해요'}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {[
          { id: 'A1', icon: UserCircle, color: '#06B6D4', label: '제가 직접 사용해요', sub: '65세 이상 의치 사용자', desc: '오늘의 할 일·진행률·응급 도움' },
          { id: 'A2', icon: Heart, color: '#F472B6', label: '가족이 도와줘요', sub: '자녀·배우자', desc: '어머니/아버지의 진행률 확인 · 응급 알림' },
          { id: 'A3', icon: Building2, color: '#34D399', label: '시설에서 사용해요', sub: '요양보호사·시설 관리자', desc: '담당 어르신 다수 관리 · 시설 통계' },
          { id: 'A5', icon: ShieldCheck, color: '#A5B4FC', label: '시스템 관리자입니다', sub: '앱 전체 운영자', desc: '전체 사용자·시설 통계 · 시스템 모니터링' },
          { id: 'A4', icon: Stethoscope, color: '#A78BFA', label: '치과 전문가입니다', sub: '치과의사·치위생사', desc: '응급 회신·임상 측정', disabled: true },
        ].map(a => {
          const Icon = a.icon;
          return (
            <button
              key={a.id}
              onClick={() => !a.disabled && selectActor(a.id)}
              disabled={a.disabled}
              style={{
                background: a.disabled ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
                border: `1px solid rgba(255,255,255,${a.disabled ? 0.1 : 0.2})`,
                borderRadius: 14, padding: '16px',
                display: 'flex', alignItems: 'center', gap: 14,
                textAlign: 'left', cursor: a.disabled ? 'not-allowed' : 'pointer',
                opacity: a.disabled ? 0.4 : 1, color: '#fff',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div style={{
                width: 46, height: 46, borderRadius: 12,
                background: a.color + '30', color: a.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}><Icon size={26} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: (15 + fontScale), fontWeight: 700, color: a.color, letterSpacing: '0.05em' }}>{a.id}</span>
                  {a.disabled && <span style={{ fontSize: (13 + fontScale), padding: '2px 5px', background: 'rgba(255,255,255,0.15)', borderRadius: 5 }}>예정</span>}
                </div>
                <p style={{ fontSize: (20 + fontScale), fontWeight: 700, margin: 0, lineHeight: 1.3 }}>{a.label}</p>
                <p style={{ fontSize: (15 + fontScale), opacity: 0.7, margin: '2px 0 3px' }}>{a.sub}</p>
                <p style={{ fontSize: (16 + fontScale), opacity: 0.85, margin: 0 }}>{a.desc}</p>
              </div>
              {!a.disabled && <ChevronRight size={20} style={{ opacity: 0.5 }} />}
            </button>
          );
        })}
      </div>

      {isSwitch && (
        <button onClick={() => setShowActorSwitch(false)} style={{
          marginTop: 16, background: 'transparent',
          border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10,
          padding: '12px', color: '#fff', fontSize: (17 + fontScale), fontWeight: 600,
          cursor: 'pointer',
        }}>취소하고 돌아가기</button>
      )}
    </div>
  );

  // ===========================================
  // ============ 온보딩 마법사 (v4 신규) =========
  // ===========================================
  // ===========================================
  // ============ 환자 등록 마법사 (v5) ===========
  // ===========================================
  // 1=환영, 2=기본정보(이름·나이), 3=틀니제작시기, 4=단골치과, 5=보호자(선택), 6=완료
  const renderOnboarding = () => {
    const totalSteps = 6;
    const progress = (onboardingStep / totalSteps) * 100;

    // 공통 레이아웃
    const wrap = (content, opts = {}) => (
      <div style={{
        background: colors.bg, minHeight: '100%',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* 진행 표시 */}
        <div style={{
          padding: '16px 18px 12px',
          background: colors.surface, borderBottom: `1px solid ${colors.border}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: (16 + fontScale), color: colors.textSub, fontWeight: 600 }}>
              {onboardingStep} / {totalSteps} 단계
            </span>
            {opts.canSkip && (
              <button onClick={skipOnboarding} style={{
                background: 'transparent', border: 'none',
                color: colors.textSub, fontSize: (16 + fontScale), fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
              }}>
                <SkipForward size={13} /> 모두 건너뛰기
              </button>
            )}
          </div>
          <div style={{ height: 5, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              width: `${progress}%`, height: '100%',
              background: colors.primary, borderRadius: 99,
              transition: 'width 0.3s',
            }} />
          </div>
        </div>

        {/* 콘텐츠 */}
        <div style={{ flex: 1, padding: '24px 20px 20px', overflowY: 'auto' }}>
          {content}
        </div>

        {/* 하단 버튼 */}
        <div style={{
          padding: '14px 18px', background: colors.surface,
          borderTop: `1px solid ${colors.border}`,
          display: 'flex', gap: 10,
        }}>
          {onboardingStep > 1 && (
            <button onClick={prevOnboardingStep} style={{
              background: 'transparent', color: colors.textSub,
              border: `1px solid ${colors.border}`, borderRadius: 12,
              padding: '14px 20px', fontSize: (19 + fontScale), fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <ChevronLeft size={18} /> 이전
            </button>
          )}
          {opts.canSkip && (
            <button onClick={nextOnboardingStep} style={{
              background: 'transparent', color: colors.textSub,
              border: `1px solid ${colors.border}`, borderRadius: 12,
              padding: '14px 20px', fontSize: (19 + fontScale), fontWeight: 600, cursor: 'pointer',
            }}>건너뛰기</button>
          )}
          <button onClick={nextOnboardingStep}
            disabled={opts.canProceed === false}
            style={{
              flex: 1,
              background: opts.canProceed === false ? '#CBD5E1' : colors.primary,
              color: '#fff', border: 'none', borderRadius: 12,
              padding: '14px 20px', fontSize: (20 + fontScale), fontWeight: 700,
              cursor: opts.canProceed === false ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
            {onboardingStep === totalSteps ? '시작하기' : '다음'}
            {onboardingStep < totalSteps && <ChevronRight size={18} />}
          </button>
        </div>
      </div>
    );

    // ===== STEP 1. 환영 =====
    if (onboardingStep === 1) {
      return wrap(
        <div style={{ textAlign: 'center', paddingTop: 20 }}>
          <div style={{
            width: 96, height: 96, borderRadius: 24,
            background: colors.primaryLight, color: colors.primary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <Heart size={52} fill={colors.primary} />
          </div>
          <h1 style={{ fontSize: (30 + fontScale), fontWeight: 800, margin: '0 0 10px', letterSpacing: '-0.02em' }}>
            환영합니다!
          </h1>
          <p style={{ fontSize: (19 + fontScale), color: colors.textSub, margin: '0 0 20px', lineHeight: 1.6 }}>
            DentureCare가 어르신의<br />틀니 관리를 도와드려요
          </p>

          <div style={{
            background: colors.surface, border: `1px solid ${colors.border}`,
            borderRadius: 16, padding: '18px', textAlign: 'left', marginBottom: 14,
          }}>
            <p style={{ fontSize: (17 + fontScale), fontWeight: 700, color: colors.primary, margin: '0 0 12px' }}>
              📋 환자 등록 5단계
            </p>
            {[
              { num: '1', text: '이름과 나이 알려주기' },
              { num: '2', text: '틀니 제작시기 (리콜 자동 계산)' },
              { num: '3', text: '단골 치과 등록' },
              { num: '4', text: '가족 보호자 초대 (선택)' },
              { num: '5', text: '완료 → 사용 시작' },
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '6px 0',
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: colors.primaryLight, color: colors.primary,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: (16 + fontScale), fontWeight: 800, flexShrink: 0,
                }}>{item.num}</div>
                <span style={{ fontSize: (18 + fontScale), color: colors.text }}>{item.text}</span>
              </div>
            ))}
          </div>

          <div style={{
            background: '#FFFBEB', border: `1px solid #FCD34D`,
            borderRadius: 10, padding: '10px 14px',
            fontSize: (16 + fontScale), color: '#78350F', lineHeight: 1.5,
          }}>
            💡 약 2-3분이면 끝나요. 천천히 입력하셔도 돼요.
          </div>
        </div>
      );
    }

    // ===== STEP 2. 기본 정보 (이름 + 나이) =====
    if (onboardingStep === 2) {
      const canProceed = onboardingData.name.length >= 2;
      const age = onboardingData.birthYear.length === 4
        ? new Date().getFullYear() - parseInt(onboardingData.birthYear)
        : null;
      return wrap(
        <div>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: colors.primaryLight, color: colors.primary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 14,
          }}>
            <User size={26} />
          </div>
          <h2 style={{ fontSize: (26 + fontScale), fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            환자 정보
          </h2>
          <p style={{ fontSize: (18 + fontScale), color: colors.textSub, margin: '0 0 22px' }}>
            누구의 틀니 관리를 도와드릴까요?
          </p>

          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: (18 + fontScale), fontWeight: 600, display: 'block', marginBottom: 8 }}>
              이름 <span style={{ color: colors.danger }}>*</span>
            </label>
            <input
              type="text"
              value={onboardingData.name}
              onChange={(e) => setOnboardingData({ ...onboardingData, name: e.target.value })}
              placeholder="예: 김순자"
              style={{
                width: '100%', padding: '14px 16px',
                fontSize: (21 + fontScale), fontFamily: 'inherit',
                border: `2px solid ${colors.border}`, borderRadius: 12,
                background: '#fff', boxSizing: 'border-box', outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: (18 + fontScale), fontWeight: 600, display: 'block', marginBottom: 8 }}>
              출생연도 <span style={{ color: colors.textSub, fontSize: (16 + fontScale), fontWeight: 400 }}>(선택)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={onboardingData.birthYear}
              onChange={(e) => setOnboardingData({ ...onboardingData, birthYear: e.target.value.replace(/\D/g, '') })}
              placeholder="예: 1948"
              style={{
                width: '100%', padding: '14px 16px',
                fontSize: (21 + fontScale), fontFamily: 'inherit',
                border: `2px solid ${colors.border}`, borderRadius: 12,
                background: '#fff', boxSizing: 'border-box', outline: 'none',
              }}
            />
            {age !== null && age > 0 && age < 120 && (
              <p style={{
                fontSize: (17 + fontScale), color: colors.primary, margin: '8px 0 0',
                fontWeight: 600,
              }}>
                현재 만 {age}세 ({age >= 65 ? '노인 친화 화면 적용' : '일반 화면 적용'})
              </p>
            )}
          </div>

          <div>
            <label style={{ fontSize: (18 + fontScale), fontWeight: 600, display: 'block', marginBottom: 8 }}>
              연락처 <span style={{ color: colors.textSub, fontSize: (16 + fontScale), fontWeight: 400 }}>(선택)</span>
            </label>
            <input
              type="tel"
              value={onboardingData.phone}
              onChange={(e) => setOnboardingData({ ...onboardingData, phone: e.target.value })}
              placeholder="010-0000-0000"
              style={{
                width: '100%', padding: '14px 16px',
                fontSize: (21 + fontScale), fontFamily: 'inherit',
                border: `2px solid ${colors.border}`, borderRadius: 12,
                background: '#fff', boxSizing: 'border-box', outline: 'none',
              }}
            />
            <p style={{ fontSize: (15 + fontScale), color: colors.textSub, margin: '6px 0 0' }}>
              응급 시 가족·치과에 알릴 때 사용해요
            </p>
          </div>
        </div>,
        { canProceed }
      );
    }

    // ===== STEP 3. 틀니 제작시기 =====
    if (onboardingStep === 3) {
      const canProceed = true; // 선택사항 - 입력 안 해도 통과
      const hasData = onboardingData.dentureMadeYear.length === 4 && onboardingData.dentureMadeMonth;
      const preview = hasData ? calculateRecall(onboardingData.dentureMadeYear, onboardingData.dentureMadeMonth) : null;
      const currentYear = new Date().getFullYear();
      const years = [];
      for (let y = currentYear; y >= currentYear - 20; y--) years.push(y);
      const months = Array.from({ length: 12 }, (_, i) => i + 1);

      return wrap(
        <div>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: colors.accent + '20', color: colors.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 14,
          }}>
            <Calendar size={26} />
          </div>
          <h2 style={{ fontSize: (26 + fontScale), fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            틀니 제작시기
          </h2>
          <p style={{ fontSize: (18 + fontScale), color: colors.textSub, margin: '0 0 20px', lineHeight: 1.5 }}>
            언제 틀니를 만드셨나요?<br />
            <span style={{ fontSize: (16 + fontScale) }}>입력하시면 검진 일정을 자동으로 잡아드려요. 모르시면 건너뛰셔도 돼요.</span>
          </p>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: (18 + fontScale), fontWeight: 600, display: 'block', marginBottom: 8 }}>
              제작 연도 <span style={{ color: colors.textSub, fontSize: (16 + fontScale), fontWeight: 400 }}>(선택)</span>
            </label>
            <select
              value={onboardingData.dentureMadeYear}
              onChange={(e) => setOnboardingData({ ...onboardingData, dentureMadeYear: e.target.value })}
              style={{
                width: '100%', padding: '14px 16px',
                fontSize: (21 + fontScale), fontFamily: 'inherit',
                border: `2px solid ${colors.border}`, borderRadius: 12,
                background: '#fff', boxSizing: 'border-box', outline: 'none',
                appearance: 'none',
                backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%234B5563\' stroke-width=\'2\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 14px center',
                backgroundSize: '20px',
                paddingRight: 44,
              }}
            >
              <option value="">선택해주세요</option>
              {years.map(y => <option key={y} value={String(y)}>{y}년</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: (18 + fontScale), fontWeight: 600, display: 'block', marginBottom: 8 }}>
              제작 월 <span style={{ color: colors.textSub, fontSize: (16 + fontScale), fontWeight: 400 }}>(선택)</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
              {months.map(m => (
                <button
                  key={m}
                  onClick={() => setOnboardingData({ ...onboardingData, dentureMadeMonth: String(m) })}
                  style={{
                    padding: '12px 0',
                    background: onboardingData.dentureMadeMonth === String(m) ? colors.primary : colors.surface,
                    color: onboardingData.dentureMadeMonth === String(m) ? '#fff' : colors.text,
                    border: `1px solid ${onboardingData.dentureMadeMonth === String(m) ? colors.primary : colors.border}`,
                    borderRadius: 10,
                    fontSize: (18 + fontScale), fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {m}월
                </button>
              ))}
            </div>
          </div>

          {/* 리콜 자동 계산 미리보기 */}
          {preview && (
            <div style={{
              background: `linear-gradient(135deg, ${colors.primaryLight} 0%, #DBEAFE 100%)`,
              border: `2px solid ${colors.primary}`,
              borderRadius: 14, padding: '16px',
              marginTop: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Sparkles size={18} color={colors.primary} />
                <p style={{ fontSize: (17 + fontScale), fontWeight: 700, margin: 0, color: colors.primary }}>
                  자동 계산 결과
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ fontSize: (16 + fontScale), color: colors.textSub }}>경과 기간</span>
                <span style={{ fontSize: (17 + fontScale), fontWeight: 700 }}>{preview.monthsSince}개월</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ fontSize: (16 + fontScale), color: colors.textSub }}>현재 단계</span>
                <span style={{ fontSize: (17 + fontScale), fontWeight: 700, color: colors.primary }}>{preview.phase}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ fontSize: (16 + fontScale), color: colors.textSub }}>다음 검진</span>
                <span style={{ fontSize: (17 + fontScale), fontWeight: 700, color: colors.accent }}>
                  {preview.intervalMonths}개월 뒤
                </span>
              </div>
              <div style={{
                marginTop: 10, padding: '10px 12px',
                background: '#fff', borderRadius: 8,
                fontSize: (15 + fontScale), color: colors.textSub, lineHeight: 1.5,
              }}>
                💡 {preview.note}
              </div>
            </div>
          )}

          <div style={{
            marginTop: 14, padding: '10px 12px',
            background: '#F1F5F9', borderRadius: 10,
            fontSize: (15 + fontScale), color: colors.textSub, lineHeight: 1.5,
          }}>
            📚 <strong>근거:</strong> Tallgren (1972), Atwood (1971) 잔존 치조제 흡수 연구 기반
          </div>
        </div>,
        { canProceed }
      );
    }

    // ===== STEP 4. 단골 치과 등록 =====
    if (onboardingStep === 4) {
      return wrap(
        <div>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: '#F5F3FF', color: '#6D28D9',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 14,
          }}>
            <Stethoscope size={26} />
          </div>
          <h2 style={{ fontSize: (26 + fontScale), fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            단골 치과
          </h2>
          <p style={{ fontSize: (18 + fontScale), color: colors.textSub, margin: '0 0 18px', lineHeight: 1.5 }}>
            응급 시 1탭으로 바로 연결돼요
          </p>

          <div style={{
            background: colors.surface, border: `2px solid ${colors.border}`,
            borderRadius: 12, padding: '0 14px',
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
          }}>
            <Search size={20} color={colors.textSub} />
            <input
              type="text"
              placeholder="치과 이름 또는 지역으로 검색"
              style={{
                flex: 1, padding: '14px 0',
                fontSize: (19 + fontScale), fontFamily: 'inherit',
                border: 'none', outline: 'none', background: 'transparent',
              }}
            />
          </div>

          <p style={{ fontSize: (16 + fontScale), color: colors.textSub, margin: '0 0 8px 4px', fontWeight: 600 }}>
            추천 치과
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dentalClinics.map(c => {
              const selected = onboardingData.dentalClinic === c.name;
              return (
                <button key={c.id}
                  onClick={() => setOnboardingData({
                    ...onboardingData,
                    dentalClinic: c.name,
                    dentalClinicPhone: c.phone,
                  })}
                  style={{
                    background: selected ? colors.primaryLight : colors.surface,
                    border: `2px solid ${selected ? colors.primary : (c.primary ? '#FCD34D' : colors.border)}`,
                    borderRadius: 12, padding: '14px',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 10,
                    textAlign: 'left',
                  }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: '#F5F3FF', color: '#6D28D9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}><Stethoscope size={20} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <p style={{ fontSize: (18 + fontScale), fontWeight: 700, margin: 0 }}>{c.name}</p>
                      {c.primary && (
                        <span style={{
                          fontSize: (13 + fontScale), padding: '2px 6px',
                          background: '#FEF3C7', color: '#92400E',
                          borderRadius: 4, fontWeight: 700,
                        }}>⭐ 추천</span>
                      )}
                    </div>
                    <p style={{ fontSize: (15 + fontScale), color: colors.textSub, margin: '2px 0 0' }}>
                      {c.region} · {c.distance}
                    </p>
                    <p style={{ fontSize: (15 + fontScale), color: colors.primary, margin: '2px 0 0', fontWeight: 600 }}>
                      📞 {c.phone}
                    </p>
                  </div>
                  {selected && <Check size={20} color={colors.primary} />}
                </button>
              );
            })}
          </div>

          <div style={{
            marginTop: 14, padding: '12px 14px',
            background: '#FFFBEB', border: `1px solid #FCD34D`,
            borderRadius: 10,
            fontSize: (16 + fontScale), color: '#78350F', lineHeight: 1.5,
          }}>
            <strong>건너뛰어도 괜찮아요.</strong> 응급 시엔 119로 안내해드려요.
          </div>
        </div>,
        { canSkip: true }
      );
    }

    // ===== STEP 5. 보호자 초대 (선택) =====
    if (onboardingStep === 5) {
      return wrap(
        <div>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: '#FCE7F3', color: colors.a2Color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 14,
          }}>
            <UserPlus size={26} />
          </div>
          <h2 style={{ fontSize: (26 + fontScale), fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            가족 보호자 초대
          </h2>
          <p style={{ fontSize: (18 + fontScale), color: colors.textSub, margin: '0 0 20px', lineHeight: 1.5 }}>
            가족이 함께 챙겨드릴 수 있어요. (선택사항)
          </p>

          <div style={{
            background: colors.surface, border: `1px solid ${colors.border}`,
            borderRadius: 16, padding: '18px', marginBottom: 14,
          }}>
            <p style={{ fontSize: (17 + fontScale), fontWeight: 700, color: colors.primary, margin: '0 0 10px' }}>
              ✨ 초대 코드
            </p>
            <p style={{ fontSize: (16 + fontScale), color: colors.textSub, margin: '0 0 12px', lineHeight: 1.5 }}>
              가족이 자신의 휴대폰에 이 코드를 입력하면 연결돼요
            </p>
            <div style={{
              background: colors.primaryLight, color: colors.primary,
              borderRadius: 12, padding: '18px',
              fontSize: (36 + fontScale), fontWeight: 800, letterSpacing: '0.2em',
              textAlign: 'center', fontFamily: 'monospace',
              marginBottom: 10,
            }}>
              4 8 7 2 9 1
            </div>
            <button onClick={() => alert('카카오톡으로 초대 링크 공유')}
              style={{
                width: '100%', background: '#FEE500', color: '#000',
                border: 'none', borderRadius: 10, padding: '12px',
                fontSize: (18 + fontScale), fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
              <Send size={16} /> 카카오톡으로 보내기
            </button>
          </div>

          <div style={{
            background: '#EEF2FF', border: `1px solid #C7D2FE`,
            borderRadius: 10, padding: '12px 14px',
            display: 'flex', gap: 8,
          }}>
            <Shield size={16} color="#4338CA" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: (15 + fontScale), color: '#312E81', margin: 0, lineHeight: 1.5 }}>
              초대받은 분이 코드를 입력해도, 어르신이 한 번 더 승인하셔야 연결돼요.
            </p>
          </div>
        </div>,
        { canSkip: true }
      );
    }

    // ===== STEP 6. 완료 =====
    if (onboardingStep === 6) {
      return wrap(
        <div style={{ textAlign: 'center', paddingTop: 20 }}>
          <div style={{
            width: 90, height: 90, borderRadius: '50%',
            background: colors.success, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <Check size={50} strokeWidth={3} />
          </div>
          <h1 style={{ fontSize: (28 + fontScale), fontWeight: 800, margin: '0 0 10px', letterSpacing: '-0.02em' }}>
            등록 완료!
          </h1>
          <p style={{ fontSize: (18 + fontScale), color: colors.textSub, margin: '0 0 22px', lineHeight: 1.6 }}>
            {onboardingData.name || '어르신'}님, 잘 오셨어요.
          </p>

          <div style={{
            background: colors.surface, border: `1px solid ${colors.border}`,
            borderRadius: 14, padding: '16px 18px',
            textAlign: 'left', marginBottom: 12,
          }}>
            <p style={{ fontSize: (16 + fontScale), fontWeight: 700, color: colors.primary, margin: '0 0 12px' }}>
              ✓ 등록 정보
            </p>
            {[
              ['이름', onboardingData.name || '미입력'],
              ['나이', onboardingData.birthYear ? `만 ${new Date().getFullYear() - parseInt(onboardingData.birthYear)}세` : '미입력'],
              ['틀니 제작', onboardingData.dentureMadeYear && onboardingData.dentureMadeMonth
                ? `${onboardingData.dentureMadeYear}년 ${onboardingData.dentureMadeMonth}월` : '미입력'],
              ['단골 치과', onboardingData.dentalClinic || '등록 안 함'],
            ].map(([k, v], i, arr) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: i < arr.length - 1 ? `1px solid ${colors.border}` : 'none',
              }}>
                <span style={{ fontSize: (17 + fontScale), color: colors.textSub }}>{k}</span>
                <span style={{ fontSize: (17 + fontScale), fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>

          {/* 리콜 정보 강조 */}
          {recallInfo && (
            <div style={{
              background: `linear-gradient(135deg, ${colors.accent}15 0%, ${colors.accent}30 100%)`,
              border: `2px solid ${colors.accent}`,
              borderRadius: 14, padding: '14px 16px',
              textAlign: 'left',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Calendar size={16} color={colors.accent} />
                <p style={{ fontSize: (16 + fontScale), fontWeight: 700, margin: 0, color: '#92400E' }}>
                  다음 검진 일정
                </p>
              </div>
              <p style={{ fontSize: (22 + fontScale), fontWeight: 800, margin: 0, color: colors.text }}>
                {recallInfo.nextRecallStr}
              </p>
              <p style={{ fontSize: (15 + fontScale), color: '#78350F', margin: '4px 0 0' }}>
                {recallInfo.dDay}일 뒤 · {recallInfo.phase}
              </p>
            </div>
          )}

          {/* 미입력 항목 안내 (v6 신규) */}
          {(() => {
            const missing = [];
            if (!onboardingData.birthYear) missing.push('출생연도');
            if (!onboardingData.dentureMadeYear || !onboardingData.dentureMadeMonth) missing.push('틀니 제작시기');
            if (!onboardingData.dentalClinic) missing.push('단골 치과');

            if (missing.length === 0) return null;

            return (
              <div style={{
                marginTop: 12,
                background: '#EEF2FF', border: `1px solid #C7D2FE`,
                borderRadius: 12, padding: '12px 14px',
                textAlign: 'left',
                display: 'flex', gap: 8,
              }}>
                <AlertCircle size={16} color="#4338CA" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ fontSize: (16 + fontScale), fontWeight: 700, margin: '0 0 4px', color: '#312E81' }}>
                    아직 입력 안 한 정보
                  </p>
                  <p style={{ fontSize: (15 + fontScale), color: '#3730A3', margin: '0 0 4px' }}>
                    {missing.join(' · ')}
                  </p>
                  <p style={{ fontSize: (15 + fontScale), color: '#4338CA', margin: 0, lineHeight: 1.5 }}>
                    💡 설정 화면에서 나중에 추가하실 수 있어요
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      );
    }

    return null;
  };

  // ===========================================
  // ============ 공통 헤더 =====================
  // ===========================================
  const Header = ({ title, subtitle, onBack, danger, actorBadge }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '20px 18px 16px',
      borderBottom: `1px solid ${colors.border}`,
      backgroundColor: danger ? colors.danger : colors.surface,
      color: danger ? '#fff' : colors.text,
    }}>
      {onBack && (
        <button onClick={onBack} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: 6, color: 'inherit', display: 'flex', alignItems: 'center',
        }}><ArrowLeft size={26} /></button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ fontSize: (25 + fontScale), fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>{title}</h1>
        {subtitle && <p style={{ fontSize: (16 + fontScale), margin: '2px 0 0', opacity: 0.7 }}>{subtitle}</p>}
      </div>
      {actorBadge && (
        <span style={{
          fontSize: (15 + fontScale), padding: '4px 10px', borderRadius: 99,
          background: actorBadge.bg, color: actorBadge.fg, fontWeight: 700,
        }}>{actorBadge.label}</span>
      )}
    </div>
  );

  // ===========================================
  // ============ 공통 설정 화면 ==================
  // ===========================================
  const renderSettingsScreen = ({ actorColor, actorLabel }) => {
    const dentureMadeStr = onboardingData.dentureMadeYear && onboardingData.dentureMadeMonth
      ? `${onboardingData.dentureMadeYear}년 ${onboardingData.dentureMadeMonth}월`
      : '미등록';
    const ageStr = onboardingData.birthYear
      ? `만 ${new Date().getFullYear() - parseInt(onboardingData.birthYear)}세`
      : '미등록';

    const settingsItems = {
      A1: [
        { icon: User, label: '이름', value: onboardingData.name || '미등록', editable: true, key: 'name' },
        { icon: Calendar, label: '나이', value: ageStr, editable: true, key: 'birthYear' },
        { icon: Sparkles, label: '틀니 제작시기', value: dentureMadeStr, editable: true, key: 'dentureDate', critical: true },
        { icon: Stethoscope, label: '단골 치과', value: onboardingData.dentalClinic || '미등록', editable: true, key: 'clinic' },
        { icon: Bell, label: '루틴 시간', value: '5회/일', editable: true, key: 'routineTime' },
        { icon: Volume2, label: '음성 안내', value: '켜짐' },
        { icon: Users, label: '보호자', value: '딸 김미선' },
        { icon: UserPlus, label: '글자 크기', value: fontSizeMode === 'small' ? '작게' : fontSizeMode === 'large' ? '크게' : '보통', editable: true, key: 'fontSize' },
      ],
      A2: [
        { icon: Bell, label: '알림 받기', value: '응급만' },
        { icon: Heart, label: '연결된 어르신', value: '김순자 (어머니)' },
        { icon: MessageCircle, label: '격려 메시지', value: '자동 추천' },
        { icon: Phone, label: '비상 연락처', value: '치과·119' },
      ],
      A3: [
        { icon: Building2, label: '소속 시설', value: facility.name },
        { icon: Users, label: '담당 어르신', value: `${elders.length}명` },
        { icon: Bell, label: '교대 알림', value: '주야 모두' },
        { icon: FileText, label: '인계장 양식', value: '시설 표준' },
      ],
      A5: [
        { icon: Server, label: '시스템 상태', value: '정상' },
        { icon: Database, label: '데이터베이스', value: '동기화됨' },
        { icon: Shield, label: '보안 정책', value: 'WCAG 2.1 AA' },
        { icon: Globe, label: '서비스 지역', value: '전국' },
      ],
    };
    const items = settingsItems[actor] || [];

    return (
      <div>
        <Header title="설정" actorBadge={{ label: actorLabel, bg: actorColor + '20', fg: actorColor }} />
        <div style={{ padding: '16px 14px 100px' }}>
          {items.map((s, i) => {
            const Icon = s.icon;
            const handleClick = () => {
              if (!s.editable) return;
              if (s.critical) {
                // v11: 틀니 제작시기 수정 화면 직접 띄우기
                setEditYear(onboardingData.dentureMadeYear || '');
                setEditMonth(onboardingData.dentureMadeMonth || '');
                setShowDentureDateEdit(true);
              } else if (s.key === 'fontSize') {
                // v12.1: 글자 크기 선택 다이얼로그
                setShowFontSizeDialog(true);
              } else if (s.key === 'routineTime') {
                // v12.2: 루틴 시간 편집 다이얼로그
                setShowRoutineTimeDialog(true);
              } else {
                // 다른 환자 정보는 간단 alert (실제로는 별도 편집 화면)
                const prompt = `${s.label} 수정\n\n현재 값: ${s.value}\n\n(프로토타입에서는 새 값 입력 받지 않음 - 실제 앱에서는 편집 화면으로 이동)`;
                alert(prompt);
              }
            };
            return (
              <div key={i}
                onClick={handleClick}
                style={{
                  background: colors.surface, border: `1px solid ${colors.border}`,
                  borderRadius: 12, padding: '14px 16px', marginBottom: 10,
                  display: 'flex', alignItems: 'center', gap: 12,
                  cursor: s.editable ? 'pointer' : 'default',
                }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: actorColor + '15', color: actorColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}><Icon size={20} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: (19 + fontScale), fontWeight: 600 }}>{s.label}</span>
                    {s.critical && (
                      <span style={{
                        fontSize: (13 + fontScale), padding: '1px 5px',
                        background: '#FEF3C7', color: '#92400E',
                        borderRadius: 4, fontWeight: 700,
                      }}>중요</span>
                    )}
                  </div>
                </div>
                <span style={{ fontSize: (17 + fontScale), color: colors.textSub }}>{s.value}</span>
                <ChevronRight size={18} color={colors.textSub} />
              </div>
            );
          })}

          {/* 역할 전환 (모든 액터 공통) */}
          <button
            onClick={() => setShowActorSwitch(true)}
            style={{
              width: '100%', marginTop: 16,
              background: colors.surface,
              border: `1px solid ${colors.border}`, borderRadius: 12,
              padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
              cursor: 'pointer', color: colors.text,
            }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: '#FEF3C7', color: '#92400E',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><RefreshCw size={20} /></div>
            <span style={{ fontSize: (19 + fontScale), fontWeight: 600, flex: 1, textAlign: 'left' }}>다른 역할로 전환</span>
            <ChevronRight size={18} color={colors.textSub} />
          </button>

          {/* 데이터 저장 상태 (v8 신규) */}
          <div style={{
            marginTop: 12,
            background: '#DCFCE7', border: `1px solid #86EFAC`,
            borderRadius: 12, padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: '#fff', color: colors.success,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><Database size={20} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: (18 + fontScale), fontWeight: 700, margin: 0, color: colors.success }}>
                자동 저장 중
              </p>
              <p style={{ fontSize: (15 + fontScale), color: '#15803D', margin: '2px 0 0' }}>
                {lastSaved
                  ? `마지막 저장: ${lastSaved.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                  : '아직 저장 안 됨'}
              </p>
            </div>
          </div>

          {/* 데이터 초기화 (v8 신규) */}
          <button
            onClick={() => setShowResetConfirm(true)}
            style={{
              width: '100%', marginTop: 10,
              background: colors.surface,
              border: `1px solid ${colors.danger}30`, borderRadius: 12,
              padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
              cursor: 'pointer', color: colors.text,
            }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: '#FEF2F2', color: colors.danger,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><X size={20} /></div>
            <span style={{ fontSize: (19 + fontScale), fontWeight: 600, flex: 1, textAlign: 'left', color: colors.danger }}>
              모든 데이터 초기화
            </span>
            <ChevronRight size={18} color={colors.textSub} />
          </button>

          <div style={{
            marginTop: 16, background: actorColor + '10',
            borderRadius: 14, padding: '14px 16px',
          }}>
            <p style={{ fontSize: (16 + fontScale), fontWeight: 700, color: actorColor, margin: '0 0 6px' }}>
              ⚙ 시스템 정보
            </p>
            <p style={{ fontSize: (15 + fontScale), color: colors.textSub, margin: 0, lineHeight: 1.6 }}>
              DentureCare v8.0 (영구 저장)<br/>
              현재 역할: {actorLabel}<br/>
              기반: BCW · COM-B + 4-Layer + Multi-Actor
            </p>
          </div>
        </div>
      </div>
    );
  };

  // ===========================================
  // ============ A1 노인 화면들 =================
  // ===========================================
  const renderA1Home = () => (
    <div>
      <div style={{
        background: `linear-gradient(135deg, ${colors.primary} 0%, #2A7A8F 100%)`,
        color: '#fff', padding: '28px 20px 36px',
        borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: (17 + fontScale), opacity: 0.85, margin: 0 }}>안녕하세요</p>
            <p style={{ fontSize: (26 + fontScale), fontWeight: 700, margin: '2px 0 0' }}>
              {onboardingData.name || '김순자'} 어르신
            </p>
          </div>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><Heart size={26} fill="#fff" /></div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.12)', borderRadius: 12,
          padding: '10px 14px', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 10, fontSize: (17 + fontScale),
        }}>
          <Users size={16} />
          <span>
            {onboardingData.dentalClinic
              ? `${onboardingData.dentalClinic}이 함께해요`
              : '딸 김미선님과 ○○요양원이 함께해요'}
          </span>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.15)', borderRadius: 16,
          padding: '14px 18px', backdropFilter: 'blur(8px)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: (19 + fontScale), fontWeight: 600 }}>오늘의 진행</span>
            <span style={{ fontSize: (19 + fontScale), fontWeight: 700 }}>{completedToday} / {totalToday}</span>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.25)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              width: `${(completedToday / totalToday) * 100}%`,
              height: '100%', background: '#FBBF24', borderRadius: 99,
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      </div>


      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '16px 14px 0' }}>
        <div style={{ background: colors.surface, padding: '14px', borderRadius: 14, border: `1px solid ${colors.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
            <Flame size={18} color={colors.accent} />
            <span style={{ fontSize: (16 + fontScale), color: colors.textSub, fontWeight: 600 }}>연속 일수</span>
          </div>
          <p style={{ fontSize: (32 + fontScale), fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            {streak}<span style={{ fontSize: (18 + fontScale), fontWeight: 600, color: colors.textSub, marginLeft: 3 }}>일</span>
          </p>
          <p style={{ fontSize: (15 + fontScale), color: colors.textSub, margin: '2px 0 0' }}>Phase {phase}</p>
        </div>
        <div style={{ background: colors.surface, padding: '14px', borderRadius: 14, border: `1px solid ${colors.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
            <Activity size={18} color={colors.primary} />
            <span style={{ fontSize: (16 + fontScale), color: colors.textSub, fontWeight: 600 }}>관리 점수</span>
          </div>
          <p style={{ fontSize: (32 + fontScale), fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            {Math.round(automaticity * 100)}<span style={{ fontSize: (18 + fontScale), fontWeight: 600, color: colors.textSub, marginLeft: 1 }}>점</span>
          </p>
          <p style={{ fontSize: (15 + fontScale), color: colors.textSub, margin: '2px 0 0' }}>잘하고 계세요</p>
        </div>
      </div>

      <div style={{ padding: '20px 14px 100px' }}>
        <h2 style={{ fontSize: (21 + fontScale), fontWeight: 700, margin: '0 0 12px 4px' }}>오늘의 할 일</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {todayActions.map(action => {
            const Icon = action.icon;
            const isProxy = action.doneBy === 'caregiver_proxy';
            return (
              <button
                key={action.id}
                onClick={() => (setActiveAction(action), setScreen('action'))}
                style={{
                  background: action.done ? colors.primaryLight : colors.surface,
                  border: action.done ? `1px solid ${colors.success}` : `1px solid ${colors.border}`,
                  borderRadius: 14, padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  textAlign: 'left', cursor: 'pointer', width: '100%',
                }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 11,
                  background: action.done ? colors.success : colors.accent + '15',
                  color: action.done ? '#fff' : colors.accent,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>{action.done ? <Check size={22} /> : <Icon size={22} />}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: (16 + fontScale), fontWeight: 700, color: colors.primary }}>{action.time}</span>
                    <span style={{ fontSize: (16 + fontScale), color: colors.textSub }}>· {action.label}</span>
                    {isProxy && <span style={{ fontSize: (14 + fontScale), padding: '1px 6px', background: '#FEF3C7', color: '#92400E', borderRadius: 4, fontWeight: 700 }}>도움받음</span>}
                  </div>
                  <p style={{
                    fontSize: (18 + fontScale), fontWeight: action.done ? 500 : 600, margin: 0,
                    color: action.done ? colors.textSub : colors.text,
                    textDecoration: action.done ? 'line-through' : 'none',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{action.action}</p>
                </div>
                {action.done
                  ? <span style={{ fontSize: (13 + fontScale), color: colors.success, fontWeight: 600, flexShrink: 0 }}>완료 ✓</span>
                  : <ChevronRight size={20} color={colors.textSub} />}
              </button>
            );
          })}
        </div>

        {/* v10: 도움 받기 카드 (자가 보고 진입) */}
        <div style={{ padding: '4px 14px 24px' }}>
          <button
            onClick={() => setShowReportMenu(true)}
            style={{
              width: '100%',
              background: '#FEF2F2', border: `2px solid #FCA5A5`,
              borderRadius: 14, padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 11,
              background: '#fff', color: colors.danger,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: (26 + fontScale), flexShrink: 0,
            }}>
              🆘
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <p style={{ fontSize: (18 + fontScale), fontWeight: 700, margin: 0, color: colors.danger }}>
                불편한 곳이 있으세요?
              </p>
              <p style={{ fontSize: (16 + fontScale), color: '#9F1239', margin: '3px 0 0' }}>
                잇몸 통증·틀니 파손 등 알려주세요
              </p>
            </div>
            <ChevronRight size={20} color={colors.danger} />
          </button>
        </div>
      </div>
    </div>
  );

  // ★ A1 진행률 화면 (v2 누락 → 신규 추가)
  const renderA1Progress = () => {
    const phaseInfo = [
      { num: 1, label: 'Phase 1', desc: '집중 강화', range: '0-30일', active: phase === 1 },
      { num: 2, label: 'Phase 2', desc: '주간 시각화', range: '30-90일', active: phase === 2 },
      { num: 3, label: 'Phase 3', desc: 'cue 점진 철수', range: '90일+', active: phase === 3 },
    ];
    return (
      <div>
        <Header title="나의 진행률" actorBadge={{ label: 'A1', bg: '#CFFAFE', fg: colors.a1Color }} />
        <div style={{ padding: '18px 14px 100px' }}>
          <div style={{
            background: `linear-gradient(135deg, ${colors.primary} 0%, #2A7A8F 100%)`,
            color: '#fff', borderRadius: 18, padding: '20px', marginBottom: 16,
          }}>
            <p style={{ fontSize: (17 + fontScale), opacity: 0.85, margin: '0 0 4px' }}>틀니 관리 점수</p>
            <p style={{ fontSize: (52 + fontScale), fontWeight: 800, margin: 0, letterSpacing: '-0.04em', lineHeight: 1 }}>
              {Math.round(automaticity * 100)}<span style={{ fontSize: (26 + fontScale), opacity: 0.85 }}>점</span>
            </p>
            <p style={{ fontSize: (16 + fontScale), opacity: 0.8, margin: '8px 0 0' }}>
              꾸준히 하시면 점수가 올라가요
            </p>
            <svg viewBox="0 0 280 60" style={{ width: '100%', height: 56, marginTop: 12 }}>
              <defs>
                <linearGradient id="cgProg" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#FBBF24" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0,55 Q70,52 100,40 T180,20 T280,12 L280,60 L0,60 Z" fill="url(#cgProg)" />
              <path d="M0,55 Q70,52 100,40 T180,20 T280,12" fill="none" stroke="#FBBF24" strokeWidth="2.5" />
              <circle cx={(streak / 90) * 280} cy={55 - automaticity * 50} r="5" fill="#fff" stroke="#FBBF24" strokeWidth="2.5" />
            </svg>
          </div>

          <h3 style={{ fontSize: (19 + fontScale), fontWeight: 700, margin: '0 0 10px 4px' }}>자동성 형성 단계</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {phaseInfo.map(p => (
              <div key={p.num} style={{
                flex: 1,
                background: p.active ? colors.primary : colors.surface,
                color: p.active ? '#fff' : colors.text,
                border: `1px solid ${p.active ? colors.primary : colors.border}`,
                borderRadius: 12, padding: '12px 6px', textAlign: 'center',
              }}>
                <p style={{ fontSize: (15 + fontScale), fontWeight: 700, margin: 0, opacity: p.active ? 1 : 0.6 }}>{p.label}</p>
                <p style={{ fontSize: (16 + fontScale), fontWeight: 600, margin: '3px 0 1px' }}>{p.desc}</p>
                <p style={{ fontSize: (14 + fontScale), margin: 0, opacity: 0.7 }}>{p.range}</p>
              </div>
            ))}
          </div>

          <h3 style={{ fontSize: (19 + fontScale), fontWeight: 700, margin: '0 0 10px 4px' }}>이번 주</h3>
          <div style={{
            background: colors.surface, border: `1px solid ${colors.border}`,
            borderRadius: 14, padding: '14px 10px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
            gap: 5, marginBottom: 20,
          }}>
            {weekData.map((d, i) => {
              const ratio = d.completed / d.total;
              const isFull = ratio === 1;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <div style={{ height: 70, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{
                      width: '100%', height: `${ratio * 100}%`,
                      background: isFull ? colors.success : colors.accent,
                      borderRadius: 5, minHeight: 5,
                    }} />
                  </div>
                  <span style={{ fontSize: (15 + fontScale), fontWeight: 600, color: colors.textSub }}>{d.day}</span>
                  <span style={{ fontSize: (14 + fontScale), color: colors.textSub }}>{d.completed}/{d.total}</span>
                </div>
              );
            })}
          </div>

          <h3 style={{ fontSize: (19 + fontScale), fontWeight: 700, margin: '0 0 10px 4px' }}>알아두세요</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              {
                icon: Sparkles,
                title: '오늘 잘하고 계세요',
                desc: `5번 중 ${completedToday}번 완료하셨어요`,
                color: colors.success,
                bg: '#DCFCE7',
              },
              {
                icon: Calendar,
                title: '다음 치과 검진',
                desc: '34일 뒤예요 (5월 28일)',
                color: colors.primary,
                bg: colors.primaryLight,
              },
              {
                icon: Award,
                title: streak === 0 ? `오늘부터 시작해요` : `${streak}일 연속 잘하셨어요`,
                desc: streak === 0 ? `첫 솔질부터 차근차근 해봐요` : phase === 1 ? `30일까지 ${30-streak}일 남았어요` : phase === 2 ? `습관이 자리잡고 있어요` : `자동으로 챙기는 단계예요`,
                color: colors.accent,
                bg: '#FEF3C7',
              },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} style={{
                  background: colors.surface, border: `1px solid ${colors.border}`,
                  borderRadius: 12, padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 11,
                    background: item.bg, color: item.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon size={22} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: (19 + fontScale), fontWeight: 700, margin: 0, color: colors.text }}>{item.title}</p>
                    <p style={{ fontSize: (17 + fontScale), color: colors.textSub, margin: '3px 0 0' }}>{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // A1 액션 화면
  const renderA1Action = () => {
    if (!activeAction) return null;
    const Icon = activeAction.icon;
    return (
      <div>
        <Header title="지금 해야 할 일" onBack={() => setScreen('home')} />
        <div style={{ padding: '20px 18px 100px' }}>
          {/* 시간 + 라벨 배지 (시간 누르면 편집) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: colors.accent + '15', color: colors.accent,
              padding: '7px 13px', borderRadius: 99,
              fontSize: (17 + fontScale), fontWeight: 700,
            }}><Clock size={15} /> {activeAction.label}</div>

            {/* 시간 편집 버튼 - 누르면 시간 선택 팝업 */}
            <button
              onClick={() => {
                const [h, m] = activeAction.time.split(':').map(Number);
                setPickerHour(h);
                setPickerMinute(m);
                setShowTimePicker(true);
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: colors.primaryLight, color: colors.primary,
                padding: '7px 13px', borderRadius: 99,
                fontSize: (17 + fontScale), fontWeight: 700,
                cursor: 'pointer',
                border: `1.5px solid ${colors.primary}40`,
              }}>
              {activeAction.time}
              <Edit2 size={14} />
            </button>
          </div>

          <div style={{
            background: colors.surface, border: `2px solid ${colors.primary}`,
            borderRadius: 22, padding: '28px 22px', marginBottom: 14, textAlign: 'center',
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: 18,
              background: colors.primaryLight, color: colors.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 18px',
            }}><Icon size={38} /></div>
            <p style={{ fontSize: (27 + fontScale), fontWeight: 800, lineHeight: 1.35, margin: 0, letterSpacing: '-0.02em' }}>
              {activeAction.action}
            </p>
            <button onClick={() => speakText(activeAction.action)} style={{
              marginTop: 16, background: 'transparent',
              border: `1px solid ${colors.border}`, borderRadius: 10,
              padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: (17 + fontScale), fontWeight: 600, color: colors.textSub, cursor: 'pointer',
            }}><Volume2 size={16} /> 음성으로 듣기</button>
          </div>

          <div style={{
            background: colors.surface, border: `1px solid ${colors.border}`,
            borderRadius: 14, padding: '14px 16px', marginBottom: 18,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
              <span style={{ color: colors.textSub, fontSize: (17 + fontScale) }}>도구</span>
              <span style={{ fontWeight: 600, fontSize: (17 + fontScale) }}>{activeAction.tool}</span>
            </div>
            <div style={{ height: 1, background: colors.border, margin: '4px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
              <span style={{ color: colors.textSub, fontSize: (17 + fontScale) }}>소요 시간</span>
              <span style={{ fontWeight: 600, fontSize: (17 + fontScale) }}>{activeAction.duration}초</span>
            </div>
          </div>

          {activeAction.done ? (
            /* 이미 완료한 경우 - 완료 취소 가능 */
            <div>
              <div style={{
                background: colors.primaryLight, border: `1px solid ${colors.success}`,
                borderRadius: 14, padding: '16px', marginBottom: 12,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: colors.success, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}><Check size={22} /></div>
                <p style={{ fontSize: (16 + fontScale), fontWeight: 700, color: colors.success, margin: 0 }}>
                  이미 완료한 항목이에요
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button onClick={() => setScreen('home')} style={{
                  background: colors.primary, color: '#fff',
                  border: 'none', borderRadius: 14,
                  padding: '18px 14px', fontSize: (20 + fontScale), fontWeight: 700, cursor: 'pointer', minHeight: 56,
                }}>돌아가기</button>
                <button onClick={() => handleUncomplete(activeAction.id)} style={{
                  background: colors.surface, color: colors.danger,
                  border: `2px solid ${colors.danger}40`, borderRadius: 14,
                  padding: '18px 14px', fontSize: (18 + fontScale), fontWeight: 700,
                  cursor: 'pointer', minHeight: 56,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}><RefreshCw size={18} /> 완료 취소</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => setScreen('home')} style={{
                background: colors.surface, color: colors.textSub,
                border: `2px solid ${colors.border}`, borderRadius: 14,
                padding: '18px 14px', fontSize: (20 + fontScale), fontWeight: 700, cursor: 'pointer', minHeight: 56,
              }}>나중에</button>
              <button onClick={() => handleComplete(activeAction.id)} style={{
                background: colors.success, color: '#fff', border: 'none',
                borderRadius: 14, padding: '18px 14px', fontSize: (20 + fontScale), fontWeight: 700,
                cursor: 'pointer', minHeight: 56,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}><Check size={20} /> 완료했어요</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // A1 SOS 화면
  // ============ A1 검진 화면 (v7 신규) ==========
  // SOS 탭을 "치과 검진 유도" 페이지로 변경
  // 옵션 D + B 혼합: 검진 타임라인 + D-day + 응급 진입점(작게)
  const renderA1Checkup = () => {
    // showEmergency 상태는 메인 컴포넌트에서 관리 (위쪽으로 이동)
    // 지난 검진 (더미 데이터 - 6개월 전 가정)
    const lastCheckup = recallInfo ? (() => {
      const last = new Date();
      last.setMonth(last.getMonth() - recallInfo.intervalMonths);
      return {
        date: last,
        dateStr: `${last.getFullYear()}년 ${last.getMonth()+1}월 ${last.getDate()}일`,
        daysAgo: Math.ceil((new Date() - last) / (1000 * 60 * 60 * 24)),
      };
    })() : null;

    // 타임라인 진행도 (지난 검진 → 다음 검진까지의 %)
    const timelineProgress = recallInfo && lastCheckup ? (() => {
      const totalDays = lastCheckup.daysAgo + recallInfo.dDay;
      return Math.min(100, (lastCheckup.daysAgo / totalDays) * 100);
    })() : 50;

    const isUrgent = recallInfo && recallInfo.dDay <= 14;
    const isSoon = recallInfo && recallInfo.dDay <= 30;
    const dDayColor = isUrgent ? colors.danger : isSoon ? colors.accent : colors.primary;

    return (
      <div>
        <Header title="치과 검진" actorBadge={{ label: 'A1', bg: '#CFFAFE', fg: colors.a1Color }} />

        <div style={{ padding: '16px 14px 100px' }}>
          {/* 검진 타임라인 (옵션 B) */}
          {recallInfo && lastCheckup && (
            <div style={{
              background: colors.surface, border: `1px solid ${colors.border}`,
              borderRadius: 16, padding: '18px 16px', marginBottom: 14,
            }}>
              <p style={{ fontSize: (17 + fontScale), fontWeight: 700, color: colors.primary, margin: '0 0 14px' }}>
                📅 나의 검진 일정
              </p>

              <div style={{ position: 'relative', marginBottom: 10 }}>
                {/* 타임라인 막대 */}
                <div style={{
                  height: 6, background: '#F1F5F9', borderRadius: 99,
                  overflow: 'hidden', marginBottom: 14,
                }}>
                  <div style={{
                    width: `${timelineProgress}%`, height: '100%',
                    background: `linear-gradient(90deg, ${colors.success} 0%, ${dDayColor} 100%)`,
                    borderRadius: 99,
                  }} />
                </div>

                {/* 타임라인 양 끝 */}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ fontSize: (15 + fontScale), color: colors.textSub, margin: 0, fontWeight: 600 }}>지난 검진</p>
                    <p style={{ fontSize: (17 + fontScale), fontWeight: 700, margin: '2px 0 0', color: colors.text }}>
                      {lastCheckup.dateStr}
                    </p>
                    <p style={{ fontSize: (14 + fontScale), color: colors.textSub, margin: '2px 0 0' }}>
                      {lastCheckup.daysAgo}일 전
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: (15 + fontScale), color: colors.textSub, margin: 0, fontWeight: 600 }}>다음 검진</p>
                    <p style={{ fontSize: (17 + fontScale), fontWeight: 700, margin: '2px 0 0', color: dDayColor }}>
                      {recallInfo.nextRecallStr}
                    </p>
                    <p style={{ fontSize: (14 + fontScale), color: dDayColor, margin: '2px 0 0', fontWeight: 700 }}>
                      D-{recallInfo.dDay}일
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* D-day + 예약 버튼 (메인 강조) */}
          {recallInfo ? (
            <div style={{
              background: isUrgent ? '#FEF2F2' : isSoon ? '#FFFBEB' : colors.primaryLight,
              border: `2px solid ${dDayColor}`,
              borderRadius: 18, padding: '20px',
              marginBottom: 14,
              boxShadow: isUrgent ? '0 4px 12px rgba(185,28,28,0.15)' : 'none',
            }}>
              {isUrgent && (
                <div style={{
                  background: colors.danger, color: '#fff',
                  borderRadius: 8, padding: '8px 12px', marginBottom: 12,
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: (17 + fontScale), fontWeight: 700,
                }}>
                  <AlertTriangle size={16} />
                  <span>곧 검진 일정이에요! 미리 예약하세요</span>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Calendar size={20} color={dDayColor} />
                <span style={{ fontSize: (18 + fontScale), fontWeight: 700, color: dDayColor }}>
                  다음 치과 검진까지
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
                <span style={{
                  fontSize: (60 + fontScale), fontWeight: 800,
                  color: dDayColor, letterSpacing: '-0.04em', lineHeight: 1,
                }}>
                  D-{recallInfo.dDay}
                </span>
                <span style={{ fontSize: (20 + fontScale), fontWeight: 600, color: colors.textSub }}>일</span>
              </div>

              <p style={{ fontSize: (18 + fontScale), color: colors.text, margin: '6px 0 0', fontWeight: 600 }}>
                {recallInfo.nextRecallStr}
              </p>
              <p style={{ fontSize: (16 + fontScale), color: colors.textSub, margin: '4px 0 14px' }}>
                {recallInfo.phase}
              </p>

              {onboardingData.dentalClinic ? (
                <button
                  onClick={() => alert(`${onboardingData.dentalClinic}\n📞 ${onboardingData.dentalClinicPhone}\n\n예약 전화 연결...`)}
                  style={{
                    width: '100%',
                    background: dDayColor, color: '#fff', border: 'none',
                    borderRadius: 12, padding: '16px',
                    fontSize: (20 + fontScale), fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  <Phone size={20} /> {onboardingData.dentalClinic} 예약 전화
                </button>
              ) : (
                <div style={{
                  background: '#fff', borderRadius: 10, padding: '12px',
                  textAlign: 'center', color: colors.textSub, fontSize: (17 + fontScale),
                }}>
                  단골 치과를 등록하시면 1탭으로 예약할 수 있어요
                </div>
              )}
            </div>
          ) : (
            <div style={{
              background: colors.surface, border: `1px solid ${colors.border}`,
              borderRadius: 14, padding: '20px', marginBottom: 14,
              textAlign: 'center',
            }}>
              <Calendar size={36} color={colors.textSub} style={{ margin: '0 auto 10px' }} />
              <p style={{ fontSize: (18 + fontScale), fontWeight: 600, color: colors.text, margin: '0 0 4px' }}>
                틀니 제작시기를 등록해주세요
              </p>
              <p style={{ fontSize: (16 + fontScale), color: colors.textSub, margin: 0, lineHeight: 1.5 }}>
                설정 → 틀니 제작시기에서 등록하시면<br />다음 검진 일정을 자동으로 잡아드려요
              </p>
            </div>
          )}

          {/* 검진 때 무엇을 확인하는지 안내 (옵션 B) */}
          <div style={{
            background: colors.surface, border: `1px solid ${colors.border}`,
            borderRadius: 14, padding: '16px', marginBottom: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Sparkles size={18} color={colors.primary} />
              <p style={{ fontSize: (18 + fontScale), fontWeight: 700, margin: 0, color: colors.primary }}>
                검진 때 이런 걸 봐요
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { icon: '🦷', title: '틀니가 잘 맞는지', desc: '잇몸과 잘 맞는지 확인해요' },
                { icon: '💗', title: '잇몸이 괜찮은지', desc: '아프거나 빨개진 곳이 없는지 봐요' },
                { icon: '👄', title: '입 안에 헌데가 없는지', desc: '헐거나 부어오른 곳이 없는지 봐요' },
                { icon: '🔧', title: '틀니 안쪽 다시 맞춤', desc: '필요하면 잇몸에 다시 맞춰드려요' },
              ].map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 0',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 9,
                    background: colors.primaryLight,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: (20 + fontScale), flexShrink: 0,
                  }}>{item.icon}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: (17 + fontScale), fontWeight: 700, margin: 0 }}>{item.title}</p>
                    <p style={{ fontSize: (15 + fontScale), color: colors.textSub, margin: '2px 0 0' }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 정기 검진의 이점 (간단한 동기 부여) */}
          <div style={{
            background: `linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)`,
            borderRadius: 14, padding: '14px 16px', marginBottom: 14,
          }}>
            <p style={{ fontSize: (17 + fontScale), fontWeight: 700, color: '#92400E', margin: '0 0 6px' }}>
              💡 알고 계셨나요?
            </p>
            <p style={{ fontSize: (16 + fontScale), color: '#78350F', margin: 0, lineHeight: 1.6 }}>
              정기 검진을 받으면 의치성 구내염, 잇몸 손상 같은 문제를 미리 예방할 수 있어요. 작은 불편함도 큰 문제가 되기 전에 발견해요.
            </p>
          </div>

          {/* 응급 진입점 (작게, 하단에) */}
          <button
            onClick={() => setShowEmergency(true)}
            style={{
              width: '100%',
              background: colors.surface,
              border: `1px solid ${colors.danger}30`,
              borderRadius: 12, padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 10,
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: '#FEF2F2', color: colors.danger,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <AlertTriangle size={18} />
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <p style={{ fontSize: (17 + fontScale), fontWeight: 700, margin: 0, color: colors.danger }}>
                지금 아프거나 불편하면
              </p>
              <p style={{ fontSize: (15 + fontScale), color: colors.textSub, margin: '2px 0 0' }}>
                응급 도움 받기
              </p>
            </div>
            <ChevronRight size={18} color={colors.textSub} />
          </button>
        </div>

        {/* 응급 모달 (검진 탭 내부) */}
        {showEmergency && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            zIndex: 100,
          }}>
            <div style={{
              background: colors.surface,
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              width: '100%', maxHeight: '80%',
              overflowY: 'auto',
              padding: '20px 18px 24px',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
            }}>
              <div style={{
                width: 40, height: 4, background: colors.border,
                borderRadius: 99, margin: '0 auto 16px',
              }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h2 style={{ fontSize: (24 + fontScale), fontWeight: 800, margin: 0, color: colors.danger }}>
                  응급 도움
                </h2>
                <button onClick={() => setShowEmergency(false)} style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: colors.textSub, padding: 4,
                }}>
                  <X size={24} />
                </button>
              </div>

              <div style={{
                background: '#FEF2F2', border: `1px solid #FCA5A5`,
                borderRadius: 12, padding: '12px 14px', marginBottom: 14,
                display: 'flex', gap: 10,
              }}>
                <Shield size={20} color={colors.danger} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ fontWeight: 700, margin: '0 0 2px', color: colors.danger, fontSize: (17 + fontScale) }}>3-3-3 규칙</p>
                  <p style={{ margin: 0, fontSize: (16 + fontScale), color: '#7F1D1D' }}>3분 평가 · 3가지 점검 · 30분 내 치과 연결</p>
                </div>
              </div>

              <p style={{ fontSize: (17 + fontScale), fontWeight: 700, margin: '0 0 10px 4px', color: colors.text }}>
                어떤 일이 있으세요?
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                {[
                  { id: 1, icon: AlertTriangle, label: '틀니가\n깨졌어요', forbid: '직접 붙이지 마세요' },
                  { id: 2, icon: Droplet, label: '잇몸이 아프거나\n피가 나요', forbid: '뜨거운 물 ✗' },
                  { id: 3, icon: AlertCircle, label: '틀니가 잘\n안 맞아요', forbid: '씹어 끼우지 마세요' },
                  { id: 4, icon: X, label: '틀니가\n없어졌어요', forbid: '건조 보관 ✗' },
                ].map(h => {
                  const Icon = h.icon;
                  return (
                    <button key={h.id}
                      onClick={() => alert(`H${h.id} 보고\n• 가족·요양보호사·치과 동시 알림`)}
                      style={{
                        background: colors.surface, border: `2px solid ${colors.border}`,
                        borderRadius: 12, padding: '12px 10px', cursor: 'pointer',
                        textAlign: 'left', minHeight: 110,
                        display: 'flex', flexDirection: 'column', gap: 5,
                      }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: '#FEF2F2', color: colors.danger,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}><Icon size={18} /></div>
                      <p style={{ fontSize: (17 + fontScale), fontWeight: 700, margin: 0, lineHeight: 1.3, whiteSpace: 'pre-line' }}>
                        {h.label}
                      </p>
                      <p style={{ fontSize: (14 + fontScale), color: '#B91C1C', margin: 'auto 0 0', fontWeight: 600 }}>
                        ✗ {h.forbid}
                      </p>
                    </button>
                  );
                })}
              </div>

              <button onClick={() => alert('단골 치과 + 가족 동시 연결')}
                style={{
                  width: '100%', background: colors.danger, color: '#fff', border: 'none',
                  borderRadius: 14, padding: '16px', fontSize: (19 + fontScale), fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                <Phone size={20} /> 치과 + 보호자 동시 연결
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };


  // ===========================================
  // ============ A2 가족 화면들 =================
  // ===========================================
  const renderA2Home = () => (
    <div>
      <div style={{
        background: `linear-gradient(135deg, ${colors.a2Color} 0%, #6B0F2A 100%)`,
        color: '#fff', padding: '24px 20px 28px',
        borderBottomLeftRadius: 22, borderBottomRightRadius: 22,
      }}>
        <p style={{ fontSize: (16 + fontScale), opacity: 0.8, margin: 0, letterSpacing: '0.05em' }}>가족 보호자 모드</p>
        <p style={{ fontSize: (23 + fontScale), fontWeight: 700, margin: '4px 0 0' }}>김미선님, 안녕하세요</p>
        <p style={{ fontSize: (17 + fontScale), opacity: 0.85, margin: '2px 0 0' }}>{familyData.elderName} {familyData.relation} 진행 상황</p>
      </div>

      <div style={{ padding: '18px 14px 100px' }}>
        <div style={{
          background: colors.surface, borderRadius: 18, padding: '20px',
          border: `1px solid ${colors.border}`, marginBottom: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: colors.primaryLight, color: colors.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: (26 + fontScale), fontWeight: 800,
            }}>{familyData.elderName[0]}</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: (22 + fontScale), fontWeight: 700, margin: 0 }}>{familyData.elderName}</p>
              <p style={{ fontSize: (17 + fontScale), color: colors.textSub, margin: '2px 0 0' }}>{familyData.elderAge}세 · {familyData.relation}</p>
            </div>
            <div style={{
              padding: '4px 10px', background: colors.success + '15',
              color: colors.success, borderRadius: 99, fontSize: (15 + fontScale), fontWeight: 700,
            }}>● 활동중</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
            <div style={{ textAlign: 'center', padding: '10px 6px', background: '#F9FAFB', borderRadius: 10 }}>
              <p style={{ fontSize: (15 + fontScale), color: colors.textSub, margin: 0 }}>오늘</p>
              <p style={{ fontSize: (24 + fontScale), fontWeight: 800, margin: '2px 0', color: colors.text }}>
                {familyData.todayCompleted}<span style={{ fontSize: (16 + fontScale), color: colors.textSub }}>/{familyData.todayTotal}</span>
              </p>
            </div>
            <div style={{ textAlign: 'center', padding: '10px 6px', background: '#F9FAFB', borderRadius: 10 }}>
              <p style={{ fontSize: (15 + fontScale), color: colors.textSub, margin: 0 }}>연속</p>
              <p style={{ fontSize: (24 + fontScale), fontWeight: 800, margin: '2px 0', color: colors.accent }}>
                {familyData.streak}<span style={{ fontSize: (16 + fontScale), color: colors.textSub }}>일</span>
              </p>
            </div>
            <div style={{ textAlign: 'center', padding: '10px 6px', background: '#F9FAFB', borderRadius: 10 }}>
              <p style={{ fontSize: (15 + fontScale), color: colors.textSub, margin: 0 }}>자동성</p>
              <p style={{ fontSize: (24 + fontScale), fontWeight: 800, margin: '2px 0', color: colors.primary }}>
                {Math.round(familyData.automaticity * 100)}<span style={{ fontSize: (16 + fontScale), color: colors.textSub }}>%</span>
              </p>
            </div>
          </div>

          <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '10px 12px' }}>
            <p style={{ fontSize: (15 + fontScale), color: colors.textSub, margin: '0 0 2px', fontWeight: 600 }}>최근 활동</p>
            <p style={{ fontSize: (17 + fontScale), margin: 0 }}>{familyData.lastActivity}</p>
          </div>
        </div>

        <div style={{
          background: `linear-gradient(135deg, #FCE7F3 0%, #FBCFE8 100%)`,
          borderRadius: 16, padding: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <MessageCircle size={18} color={colors.a2Color} />
            <p style={{ fontSize: (18 + fontScale), fontWeight: 700, margin: 0, color: colors.a2Color }}>격려 메시지 보내기</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {['오늘도 잘하고 계셔요 어머니!', '잊지 말고 양치하세요 ❤', '오늘 저녁에 찾아뵐게요'].map((msg, i) => (
              <button key={i} onClick={() => alert(`전송: "${msg}"`)} style={{
                background: '#fff', border: 'none', borderRadius: 10,
                padding: '12px 14px', textAlign: 'left', fontSize: (17 + fontScale),
                cursor: 'pointer', color: colors.text,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span>{msg}</span>
                <Send size={14} color={colors.a2Color} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ★ A2 리포트 화면 (v2 누락 → 신규 추가)
  const renderA2Report = () => (
    <div>
      <Header title="주간 리포트" subtitle={`${familyData.elderName} ${familyData.relation}`}
        actorBadge={{ label: 'A2', bg: '#FCE7F3', fg: colors.a2Color }} />
      <div style={{ padding: '16px 14px 100px' }}>
        <div style={{
          background: `linear-gradient(135deg, ${colors.a2Color} 0%, #6B0F2A 100%)`,
          color: '#fff', borderRadius: 18, padding: '20px', marginBottom: 14,
        }}>
          <p style={{ fontSize: (17 + fontScale), opacity: 0.85, margin: 0 }}>이번 주 완료율</p>
          <p style={{ fontSize: (48 + fontScale), fontWeight: 800, margin: '6px 0 0', letterSpacing: '-0.04em', lineHeight: 1 }}>
            {Math.round(familyData.weekRate * 100)}<span style={{ fontSize: (26 + fontScale), opacity: 0.85 }}>%</span>
          </p>
          <p style={{ fontSize: (16 + fontScale), opacity: 0.8, margin: '6px 0 0' }}>지난주 79% 대비 +4%p 개선</p>
        </div>

        <div style={{
          background: colors.surface, borderRadius: 14, padding: '14px',
          border: `1px solid ${colors.border}`, marginBottom: 14,
        }}>
          <h3 style={{ fontSize: (18 + fontScale), fontWeight: 700, margin: '0 0 12px' }}>요일별 수행률</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 5, height: 80 }}>
            {weekData.map((d, i) => {
              const ratio = d.completed / d.total;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ height: 60, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{
                      width: '100%', height: `${ratio * 100}%`,
                      background: ratio === 1 ? colors.success : ratio >= 0.6 ? colors.accent : colors.warning,
                      borderRadius: 4, minHeight: 4,
                    }} />
                  </div>
                  <span style={{ fontSize: (14 + fontScale), color: colors.textSub }}>{d.day}</span>
                  <span style={{ fontSize: (13 + fontScale), color: colors.textSub }}>{d.completed}/{d.total}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{
          background: colors.surface, borderRadius: 14, padding: '14px',
          border: `1px solid ${colors.border}`, marginBottom: 14,
        }}>
          <h3 style={{ fontSize: (18 + fontScale), fontWeight: 700, margin: '0 0 10px' }}>미수행 시점 패턴</h3>
          <p style={{ fontSize: (16 + fontScale), color: colors.textSub, margin: '0 0 10px', lineHeight: 1.5 }}>
            이번 주 어머니가 가장 자주 놓친 시간대는 <strong style={{ color: colors.text }}>저녁 식후(19:00)</strong>예요. 저녁시간 알림을 30분 늦추거나 가족 식사를 함께 하시면 도움이 됩니다.
          </p>
          <div style={{ display: 'flex', gap: 6 }}>
            {['07:00', '08:00', '12:30', '19:00', '22:30'].map((t, i) => {
              const miss = i === 3 ? 4 : i === 4 ? 2 : 0;
              return (
                <div key={t} style={{
                  flex: 1, padding: '6px 4px',
                  background: miss > 2 ? '#FEE2E2' : miss > 0 ? '#FEF3C7' : '#DCFCE7',
                  borderRadius: 6, textAlign: 'center',
                }}>
                  <p style={{ fontSize: (14 + fontScale), color: colors.textSub, margin: 0 }}>{t}</p>
                  <p style={{ fontSize: (15 + fontScale), fontWeight: 700, margin: '2px 0 0', color: miss > 2 ? colors.danger : miss > 0 ? '#92400E' : colors.success }}>
                    {miss > 0 ? `-${miss}일` : '◎'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{
          background: colors.surface, borderRadius: 14, padding: '14px',
          border: `1px solid ${colors.border}`,
        }}>
          <h3 style={{ fontSize: (18 + fontScale), fontWeight: 700, margin: '0 0 10px' }}>Phase 진행</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 50, height: 50, borderRadius: 12,
              background: colors.primaryLight, color: colors.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: (26 + fontScale), fontWeight: 800,
            }}>P{phase}</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: (18 + fontScale), fontWeight: 700, margin: 0 }}>Phase {phase} 진행 중</p>
              <p style={{ fontSize: (15 + fontScale), color: colors.textSub, margin: '2px 0 0' }}>
                {phase === 1 ? '집중 강화 단계 · 다음 단계까지 ' + (30-streak) + '일' :
                 phase === 2 ? '주간 시각화 단계 · 다음 단계까지 ' + (90-streak) + '일' :
                 '점진 철수 단계 · 자기지속 형성 중'}
              </p>
              <div style={{ marginTop: 6, height: 6, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(100, (streak / 90) * 100)}%`, height: '100%',
                  background: colors.primary, borderRadius: 99,
                }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ★ A2 알림 센터 화면
  const renderA2Alerts = () => (
    <div>
      <Header title="알림 센터" actorBadge={{ label: 'A2', bg: '#FCE7F3', fg: colors.a2Color }} />
      <div style={{ padding: '16px 14px 100px' }}>
        <div style={{
          background: '#DCFCE7', border: `1px solid #86EFAC`,
          borderRadius: 12, padding: '14px 16px', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: '#fff', color: colors.success,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><ShieldCheck size={20} /></div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: (18 + fontScale), fontWeight: 700, margin: 0, color: colors.success }}>모든 게 정상이에요</p>
            <p style={{ fontSize: (15 + fontScale), color: '#15803D', margin: '2px 0 0' }}>최근 30일 응급 신고 없음</p>
          </div>
        </div>

        <h3 style={{ fontSize: (18 + fontScale), fontWeight: 700, margin: '12px 0 10px 4px' }}>최근 알림</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { time: '오늘 12:32', type: 'success', icon: Check, text: '어머니가 점심 식후 양치를 완료하셨어요', color: colors.success },
            { time: '오늘 09:15', type: 'info', icon: MessageCircle, text: '요양보호사 박○○님이 메모를 남겼어요', color: colors.primary },
            { time: '어제 22:45', type: 'warning', icon: AlertCircle, text: '어머니가 취침 전 보관을 잊으셨어요', color: colors.warning },
            { time: '3일 전', type: 'success', icon: Award, text: '연속 20일 달성! 축하드려요', color: colors.accent },
            { time: '5일 전', type: 'info', icon: Calendar, text: '다음 치과 검진까지 34일 남았어요', color: colors.primary },
          ].map((alert, i) => {
            const Icon = alert.icon;
            return (
              <div key={i} style={{
                background: colors.surface, border: `1px solid ${colors.border}`,
                borderRadius: 10, padding: '12px 14px',
                display: 'flex', gap: 12, alignItems: 'flex-start',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: alert.color + '15', color: alert.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}><Icon size={16} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: (17 + fontScale), margin: 0, lineHeight: 1.4 }}>{alert.text}</p>
                  <p style={{ fontSize: (14 + fontScale), color: colors.textSub, margin: '3px 0 0' }}>{alert.time}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ===========================================
  // ============ A3 요양보호사 화면들 ===========
  // ===========================================
  const renderA3ElderList = () => {
    const filtered = elders.filter(e => {
      if (a3Filter === 'incomplete') return e.completed < e.total;
      if (a3Filter === 'emergency') return e.emergency;
      return true;
    }).sort((a, b) => {
      if (a.emergency !== b.emergency) return a.emergency ? -1 : 1;
      return (a.completed/a.total) - (b.completed/b.total);
    });
    const totalCompleted = elders.reduce((s, e) => s + e.completed, 0);
    const totalActions = elders.reduce((s, e) => s + e.total, 0);
    const emergencyCount = elders.filter(e => e.emergency).length;

    return (
      <div>
        <div style={{
          background: `linear-gradient(135deg, ${colors.a3Color} 0%, #14532D 100%)`,
          color: '#fff', padding: '22px 18px 24px',
          borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
        }}>
          <p style={{ fontSize: (16 + fontScale), opacity: 0.8, margin: 0, letterSpacing: '0.05em' }}>요양보호사 모드</p>
          <p style={{ fontSize: (22 + fontScale), fontWeight: 700, margin: '4px 0 2px' }}>{facility.name}</p>
          <p style={{ fontSize: (17 + fontScale), opacity: 0.8, margin: 0 }}>담당 어르신 {elders.length}명</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 14 }}>
            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
              <p style={{ fontSize: (14 + fontScale), opacity: 0.85, margin: 0 }}>응답률</p>
              <p style={{ fontSize: (22 + fontScale), fontWeight: 800, margin: '2px 0 0' }}>{Math.round((totalCompleted/totalActions)*100)}%</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
              <p style={{ fontSize: (14 + fontScale), opacity: 0.85, margin: 0 }}>완료/전체</p>
              <p style={{ fontSize: (22 + fontScale), fontWeight: 800, margin: '2px 0 0' }}>{totalCompleted}/{totalActions}</p>
            </div>
            <div style={{ background: emergencyCount > 0 ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
              <p style={{ fontSize: (14 + fontScale), opacity: 0.85, margin: 0 }}>응급</p>
              <p style={{ fontSize: (22 + fontScale), fontWeight: 800, margin: '2px 0 0' }}>{emergencyCount}건</p>
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 14px 0', display: 'flex', gap: 8, overflowX: 'auto' }}>
          {[
            { id: 'all', label: `전체 (${elders.length})` },
            { id: 'incomplete', label: `미완료 (${elders.filter(e => e.completed < e.total).length})` },
            { id: 'emergency', label: `응급 (${emergencyCount})` },
          ].map(f => (
            <button key={f.id} onClick={() => setA3Filter(f.id)} style={{
              background: a3Filter === f.id ? colors.a3Color : '#fff',
              color: a3Filter === f.id ? '#fff' : colors.text,
              border: `1px solid ${a3Filter === f.id ? colors.a3Color : colors.border}`,
              borderRadius: 99, padding: '6px 14px', fontSize: (16 + fontScale),
              fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>{f.label}</button>
          ))}
        </div>

        <div style={{ padding: '14px 14px 100px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(elder => {
            const ratio = elder.completed / elder.total;
            const statusColor = elder.emergency ? colors.danger : ratio === 1 ? colors.success : ratio >= 0.6 ? colors.accent : colors.warning;
            return (
              <button key={elder.id}
                onClick={() => { setSelectedElder(elder); setScreen('elderDetail'); }}
                style={{
                  background: colors.surface,
                  border: `1px solid ${elder.emergency ? colors.danger : colors.border}`,
                  borderLeft: `4px solid ${statusColor}`,
                  borderRadius: 12, padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  textAlign: 'left', cursor: 'pointer', width: '100%',
                }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: colors.primaryLight, color: colors.primary,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: (20 + fontScale), fontWeight: 800, flexShrink: 0,
                }}>{elder.name[0]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <p style={{ fontSize: (19 + fontScale), fontWeight: 700, margin: 0 }}>{elder.name}</p>
                    <span style={{ fontSize: (15 + fontScale), color: colors.textSub }}>{elder.age}세 · {elder.room}</span>
                    {elder.emergency && (
                      <span style={{
                        fontSize: (14 + fontScale), padding: '2px 6px', background: colors.danger,
                        color: '#fff', borderRadius: 4, fontWeight: 700,
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                      }}><AlertTriangle size={10} /> 응급</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                    <div style={{ flex: 1, height: 6, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${ratio*100}%`, height: '100%', background: statusColor, borderRadius: 99 }} />
                    </div>
                    <span style={{ fontSize: (16 + fontScale), fontWeight: 700, color: statusColor, minWidth: 28 }}>
                      {elder.completed}/{elder.total}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <span style={{ fontSize: (15 + fontScale), color: colors.textSub }}>{elder.lastActivity}</span>
                    {elder.emergency && elder.emergencyType && (
                      <span style={{ fontSize: (15 + fontScale), color: colors.danger, fontWeight: 600 }}>· {elder.emergencyType}</span>
                    )}
                  </div>
                </div>
                <ChevronRight size={18} color={colors.textSub} />
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderA3ElderDetail = () => {
    if (!selectedElder) return null;
    const elder = selectedElder;
    return (
      <div>
        <Header title={elder.name} subtitle={`${elder.age}세 · ${elder.room}`}
          onBack={() => setScreen('home')}
          actorBadge={{ label: 'A3', bg: '#DCFCE7', fg: colors.a3Color }} />
        <div style={{ padding: '16px 14px 100px' }}>
          {elder.emergency && (
            <div style={{
              background: '#FEF2F2', border: `1px solid ${colors.danger}`,
              borderRadius: 12, padding: '12px 14px', marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <AlertTriangle size={20} color={colors.danger} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: (17 + fontScale), fontWeight: 700, color: colors.danger, margin: 0 }}>응급: {elder.emergencyType}</p>
                <p style={{ fontSize: (15 + fontScale), color: '#7F1D1D', margin: '2px 0 0' }}>{elder.lastActivity} 보고 · 가족·치과 통보 완료</p>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
            <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
              <p style={{ fontSize: (15 + fontScale), color: colors.textSub, margin: 0 }}>오늘</p>
              <p style={{ fontSize: (24 + fontScale), fontWeight: 800, margin: '2px 0' }}>{elder.completed}<span style={{ fontSize: (16 + fontScale), color: colors.textSub }}>/{elder.total}</span></p>
            </div>
            <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
              <p style={{ fontSize: (15 + fontScale), color: colors.textSub, margin: 0 }}>자동성</p>
              <p style={{ fontSize: (24 + fontScale), fontWeight: 800, margin: '2px 0', color: colors.primary }}>{Math.round(elder.automaticity * 100)}%</p>
            </div>
            <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
              <p style={{ fontSize: (15 + fontScale), color: colors.textSub, margin: 0 }}>Phase</p>
              <p style={{ fontSize: (24 + fontScale), fontWeight: 800, margin: '2px 0' }}>{elder.phase}</p>
            </div>
          </div>

          <h3 style={{ fontSize: (19 + fontScale), fontWeight: 700, margin: '0 0 10px 4px' }}>오늘의 할 일</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {todayActions.map(a => {
              const Icon = a.icon;
              const isProxy = a.doneBy === 'caregiver_proxy';
              return (
                <div key={a.id} style={{
                  background: colors.surface,
                  border: `1px solid ${a.done ? colors.success : colors.border}`,
                  borderRadius: 12, padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 9,
                    background: a.done ? colors.success : colors.accent + '15',
                    color: a.done ? '#fff' : colors.accent,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>{a.done ? <Check size={18} /> : <Icon size={18} />}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: (15 + fontScale), fontWeight: 700, color: colors.primary }}>{a.time}</span>
                      <span style={{ fontSize: (15 + fontScale), color: colors.textSub }}>· {a.label}</span>
                      {isProxy && <span style={{ fontSize: (13 + fontScale), padding: '1px 5px', background: '#FEF3C7', color: '#92400E', borderRadius: 4, fontWeight: 700 }}>대리</span>}
                    </div>
                    <p style={{
                      fontSize: (17 + fontScale), fontWeight: 600, margin: '2px 0 0',
                      color: a.done ? colors.textSub : colors.text,
                      textDecoration: a.done ? 'line-through' : 'none',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{a.action}</p>
                  </div>
                  {!a.done && (
                    <button onClick={() => handleComplete(a.id)} style={{
                      background: colors.a3Color, color: '#fff', border: 'none',
                      borderRadius: 8, padding: '7px 12px', fontSize: (16 + fontScale), fontWeight: 700,
                      cursor: 'pointer', whiteSpace: 'nowrap',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}><ClipboardCheck size={14} /> 도와드림</button>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{
            marginTop: 16, padding: '12px 14px',
            background: '#FFFBEB', border: `1px solid #FCD34D`, borderRadius: 10,
            fontSize: (16 + fontScale), color: '#92400E', lineHeight: 1.5,
          }}>
            <strong>알림:</strong> "도와드림"은 caregiver_proxy로 기록되며 자동성 가중치 0.3이 적용됩니다.
          </div>
        </div>
      </div>
    );
  };

  const renderA3FacilityStats = () => {
    const totalCompleted = elders.reduce((s, e) => s + e.completed, 0);
    const totalActions = elders.reduce((s, e) => s + e.total, 0);
    const avgAutomaticity = elders.reduce((s, e) => s + e.automaticity, 0) / elders.length;
    const phaseDist = [1, 2, 3].map(p => elders.filter(e => e.phase === p).length);
    return (
      <div>
        <Header title="시설 통계" subtitle={facility.name}
          actorBadge={{ label: 'A3', bg: '#DCFCE7', fg: colors.a3Color }} />
        <div style={{ padding: '16px 14px 100px' }}>
          <div style={{
            background: `linear-gradient(135deg, ${colors.a3Color} 0%, #14532D 100%)`,
            color: '#fff', borderRadius: 18, padding: '20px 18px', marginBottom: 14,
          }}>
            <p style={{ fontSize: (16 + fontScale), opacity: 0.85, margin: 0 }}>Tier 1 운영 지표 · 오늘</p>
            <p style={{ fontSize: (48 + fontScale), fontWeight: 800, margin: '4px 0', letterSpacing: '-0.04em', lineHeight: 1 }}>
              {Math.round((totalCompleted/totalActions)*100)}<span style={{ fontSize: (26 + fontScale), opacity: 0.85 }}>%</span>
            </p>
            <p style={{ fontSize: (16 + fontScale), opacity: 0.8, margin: '4px 0 0' }}>전체 응답률 · 어제 대비 +3%p</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: '14px' }}>
              <p style={{ fontSize: (16 + fontScale), color: colors.textSub, margin: 0 }}>평균 자동성</p>
              <p style={{ fontSize: (28 + fontScale), fontWeight: 800, margin: '4px 0', color: colors.primary }}>{Math.round(avgAutomaticity*100)}%</p>
            </div>
            <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: '14px' }}>
              <p style={{ fontSize: (16 + fontScale), color: colors.textSub, margin: 0 }}>이번 달 응급</p>
              <p style={{ fontSize: (28 + fontScale), fontWeight: 800, margin: '4px 0', color: colors.danger }}>2건</p>
            </div>
          </div>

          <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: '14px', marginBottom: 14 }}>
            <h3 style={{ fontSize: (17 + fontScale), fontWeight: 700, margin: '0 0 12px' }}>Phase 분포</h3>
            <div style={{ display: 'flex', height: 32, borderRadius: 8, overflow: 'hidden' }}>
              {phaseDist.map((count, i) => {
                const pct = (count / elders.length) * 100;
                const phaseColors = ['#FBBF24', '#3B82F6', '#10B981'];
                return pct > 0 && (
                  <div key={i} style={{
                    width: `${pct}%`, background: phaseColors[i],
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: (15 + fontScale), fontWeight: 700,
                  }}>P{i+1} · {count}명</div>
                );
              })}
            </div>
          </div>

          <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: '14px', marginBottom: 14 }}>
            <h3 style={{ fontSize: (17 + fontScale), fontWeight: 700, margin: '0 0 12px' }}>어르신별 자동성</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...elders].sort((a, b) => b.automaticity - a.automaticity).map(e => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: (15 + fontScale), width: 50, color: colors.textSub }}>{e.name}</span>
                  <div style={{ flex: 1, height: 14, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      width: `${e.automaticity*100}%`, height: '100%',
                      background: e.automaticity > 0.5 ? colors.success : e.automaticity > 0.3 ? colors.accent : colors.warning,
                      borderRadius: 99,
                    }} />
                  </div>
                  <span style={{ fontSize: (15 + fontScale), fontWeight: 700, width: 32, textAlign: 'right' }}>{Math.round(e.automaticity*100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderA3Handover = () => (
    <div>
      <Header title="교대 인계" subtitle="주간 → 야간"
        actorBadge={{ label: 'A3', bg: '#DCFCE7', fg: colors.a3Color }} />
      <div style={{ padding: '16px 14px 100px' }}>
        <div style={{
          background: `linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)`,
          borderRadius: 14, padding: '14px 16px', marginBottom: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <FileText size={18} color="#92400E" />
            <h3 style={{ fontSize: (18 + fontScale), fontWeight: 700, margin: 0, color: '#92400E' }}>오늘 주간 시프트 요약</h3>
          </div>
          <p style={{ fontSize: (16 + fontScale), color: '#78350F', margin: 0 }}>
            08:00 ~ 18:00 · 담당 12명 · 응답률 83% · 응급 1건
          </p>
        </div>

        <h3 style={{ fontSize: (17 + fontScale), fontWeight: 700, margin: '0 0 8px 4px' }}>📋 응급 사건</h3>
        <div style={{
          background: colors.surface, border: `1px solid ${colors.danger}`,
          borderLeft: `4px solid ${colors.danger}`,
          borderRadius: 10, padding: '12px 14px', marginBottom: 14,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <p style={{ fontSize: (18 + fontScale), fontWeight: 700, margin: 0 }}>정점례 (205호)</p>
            <span style={{ fontSize: (15 + fontScale), color: colors.danger, fontWeight: 700 }}>14:32</span>
          </div>
          <p style={{ fontSize: (16 + fontScale), margin: 0 }}>잇몸 통증 · H2 보고 · 가족·치과 통보 완료</p>
          <p style={{ fontSize: (15 + fontScale), color: colors.textSub, margin: '4px 0 0' }}>치과 회신: 내일 9시 방문 진료</p>
        </div>

        <h3 style={{ fontSize: (17 + fontScale), fontWeight: 700, margin: '0 0 8px 4px' }}>⚠ 인계 사항</h3>
        <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 10, marginBottom: 14, overflow: 'hidden' }}>
          {elders.filter(e => e.completed < e.total && !e.emergency).slice(0, 4).map((e, i, arr) => (
            <div key={e.id} style={{
              padding: '12px 14px',
              borderBottom: i < arr.length - 1 ? `1px solid ${colors.border}` : 'none',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: colors.primaryLight, color: colors.primary,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: (16 + fontScale), fontWeight: 800,
              }}>{e.name[0]}</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: (17 + fontScale), fontWeight: 700, margin: 0 }}>{e.name} <span style={{ fontWeight: 400, color: colors.textSub, fontSize: (15 + fontScale) }}>({e.room})</span></p>
                <p style={{ fontSize: (15 + fontScale), color: colors.textSub, margin: 0 }}>저녁/취침 미수행</p>
              </div>
              <span style={{
                fontSize: (15 + fontScale), padding: '2px 8px', background: colors.warning + '15',
                color: colors.warning, borderRadius: 99, fontWeight: 700,
              }}>{e.completed}/{e.total}</span>
            </div>
          ))}
        </div>

        <button onClick={() => alert('야간 시프트 인계장 발송 완료')} style={{
          width: '100%', background: colors.a3Color, color: '#fff', border: 'none',
          borderRadius: 12, padding: '14px', fontSize: (18 + fontScale), fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}><Send size={16} /> 인계장 발송</button>
      </div>
    </div>
  );

  // ===========================================
  // ============ A5 시스템 관리자 (신규) ========
  // ===========================================
  const renderA5Dashboard = () => (
    <div>
      <div style={{
        background: `linear-gradient(135deg, ${colors.a5Color} 0%, #312E81 100%)`,
        color: '#fff', padding: '24px 18px 28px',
        borderBottomLeftRadius: 22, borderBottomRightRadius: 22,
      }}>
        <p style={{ fontSize: (16 + fontScale), opacity: 0.8, margin: 0, letterSpacing: '0.05em' }}>SYSTEM ADMIN · A5</p>
        <p style={{ fontSize: (24 + fontScale), fontWeight: 700, margin: '4px 0' }}>전체 운영 현황</p>
        <p style={{ fontSize: (16 + fontScale), opacity: 0.85, margin: 0 }}>{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px' }}>
            <p style={{ fontSize: (15 + fontScale), opacity: 0.85, margin: 0 }}>총 사용자</p>
            <p style={{ fontSize: (30 + fontScale), fontWeight: 800, margin: '2px 0', letterSpacing: '-0.02em' }}>
              {adminStats.totalUsers.toLocaleString()}
            </p>
            <p style={{ fontSize: (14 + fontScale), opacity: 0.8, margin: 0 }}>전월 대비 +{adminStats.growthRate}%</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px' }}>
            <p style={{ fontSize: (15 + fontScale), opacity: 0.85, margin: 0 }}>오늘 DAU</p>
            <p style={{ fontSize: (30 + fontScale), fontWeight: 800, margin: '2px 0', letterSpacing: '-0.02em' }}>
              {adminStats.todayDAU.toLocaleString()}
            </p>
            <p style={{ fontSize: (14 + fontScale), opacity: 0.8, margin: 0 }}>활성률 70%</p>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 14px 100px' }}>
        {/* 액터별 분포 */}
        <h3 style={{ fontSize: (18 + fontScale), fontWeight: 700, margin: '0 0 10px 4px' }}>액터별 사용자 분포</h3>
        <div style={{
          background: colors.surface, border: `1px solid ${colors.border}`,
          borderRadius: 14, padding: '14px', marginBottom: 16,
        }}>
          {[
            { id: 'A1', label: '노인 본인', count: adminStats.totalElders, color: '#06B6D4', icon: UserCircle },
            { id: 'A2', label: '가족 보호자', count: adminStats.totalFamilies, color: '#F472B6', icon: Heart },
            { id: 'A3', label: '요양보호사', count: adminStats.totalCaregivers, color: '#34D399', icon: Building2 },
            { id: 'A4', label: '치과', count: adminStats.totalDental, color: '#A78BFA', icon: Stethoscope },
          ].map(a => {
            const Icon = a.icon;
            const pct = (a.count / adminStats.totalUsers) * 100;
            return (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 0',
                borderBottom: a.id !== 'A4' ? `1px solid ${colors.border}` : 'none',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: a.color + '20', color: a.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}><Icon size={16} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: (17 + fontScale), fontWeight: 600 }}>{a.label}</span>
                    <span style={{ fontSize: (16 + fontScale), color: colors.textSub }}>
                      {a.count.toLocaleString()} <span style={{ fontSize: (14 + fontScale) }}>({pct.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div style={{ height: 5, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: a.color, borderRadius: 99 }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 핵심 KPI */}
        <h3 style={{ fontSize: (18 + fontScale), fontWeight: 700, margin: '0 0 10px 4px' }}>핵심 KPI</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: '14px' }}>
            <p style={{ fontSize: (15 + fontScale), color: colors.textSub, margin: 0 }}>오늘 응답률</p>
            <p style={{ fontSize: (28 + fontScale), fontWeight: 800, margin: '4px 0', color: colors.success }}>
              {adminStats.todayResponseRate}%
            </p>
            <p style={{ fontSize: (14 + fontScale), color: colors.textSub, margin: 0 }}>Tier 1 (전국)</p>
          </div>
          <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: '14px' }}>
            <p style={{ fontSize: (15 + fontScale), color: colors.textSub, margin: 0 }}>평균 자동성</p>
            <p style={{ fontSize: (28 + fontScale), fontWeight: 800, margin: '4px 0', color: colors.primary }}>
              {Math.round(adminStats.avgAutomaticity * 100)}%
            </p>
            <p style={{ fontSize: (14 + fontScale), color: colors.textSub, margin: 0 }}>Tier 2 (SRHI)</p>
          </div>
          <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: '14px' }}>
            <p style={{ fontSize: (15 + fontScale), color: colors.textSub, margin: 0 }}>활성 시설</p>
            <p style={{ fontSize: (28 + fontScale), fontWeight: 800, margin: '4px 0', color: colors.a3Color }}>
              {adminStats.activeFacilities}
            </p>
            <p style={{ fontSize: (14 + fontScale), color: colors.textSub, margin: 0 }}>Cluster 단위</p>
          </div>
          <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: '14px' }}>
            <p style={{ fontSize: (15 + fontScale), color: colors.textSub, margin: 0 }}>월간 응급</p>
            <p style={{ fontSize: (28 + fontScale), fontWeight: 800, margin: '4px 0', color: colors.danger }}>
              {adminStats.monthlyEmergencies}
            </p>
            <p style={{ fontSize: (14 + fontScale), color: colors.textSub, margin: 0 }}>건</p>
          </div>
        </div>

        {/* 시스템 상태 */}
        <h3 style={{ fontSize: (18 + fontScale), fontWeight: 700, margin: '0 0 10px 4px' }}>시스템 상태</h3>
        <div style={{
          background: colors.surface, border: `1px solid ${colors.border}`,
          borderRadius: 14, padding: '14px 16px',
        }}>
          {[
            { label: '서버', value: '정상', color: colors.success, icon: Server },
            { label: '데이터베이스', value: '동기화됨', color: colors.success, icon: Database },
            { label: 'API 응답시간', value: '92ms', color: colors.success, icon: Zap },
            { label: '푸시 알림', value: '큐 12건 처리중', color: colors.warning, icon: Bell },
          ].map((s, i, arr) => {
            const Icon = s.icon;
            return (
              <div key={i} style={{
                padding: '10px 0',
                borderBottom: i < arr.length - 1 ? `1px solid ${colors.border}` : 'none',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <Icon size={16} color={colors.textSub} />
                <span style={{ fontSize: (17 + fontScale), flex: 1 }}>{s.label}</span>
                <span style={{
                  fontSize: (15 + fontScale), padding: '3px 8px', borderRadius: 99,
                  background: s.color + '15', color: s.color, fontWeight: 700,
                }}>● {s.value}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // A5 시설 랭킹
  const renderA5Facilities = () => (
    <div>
      <Header title="시설별 성과" subtitle={`${adminStats.activeFacilities}개 시설 · 응답률 정렬`}
        actorBadge={{ label: 'A5', bg: '#E0E7FF', fg: colors.a5Color }} />
      <div style={{ padding: '16px 14px 100px' }}>
        <div style={{
          background: '#EEF2FF', border: `1px solid #C7D2FE`,
          borderRadius: 12, padding: '12px 14px', marginBottom: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <BarChart3 size={16} color={colors.a5Color} />
            <p style={{ fontSize: (17 + fontScale), fontWeight: 700, margin: 0, color: colors.a5Color }}>Cluster-RCT 분석 단위</p>
          </div>
          <p style={{ fontSize: (15 + fontScale), color: '#3730A3', margin: 0, lineHeight: 1.5 }}>
            시설은 cluster-RCT의 무작위 배정 단위입니다. ICC ≈ 0.05 가정 시 시설당 n ≈ 30 권고.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {facilityRanking.map((f, i) => (
            <div key={f.id} style={{
              background: colors.surface, border: `1px solid ${colors.border}`,
              borderRadius: 12, padding: '14px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: i < 3 ? '#FEF3C7' : '#F1F5F9',
                color: i < 3 ? '#92400E' : colors.textSub,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: (18 + fontScale),
              }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: (18 + fontScale), fontWeight: 700, margin: 0 }}>{f.name}</p>
                <p style={{ fontSize: (15 + fontScale), color: colors.textSub, margin: '2px 0' }}>{f.region} · {f.elders}명</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <span style={{
                    fontSize: (14 + fontScale), padding: '2px 6px', borderRadius: 4,
                    background: colors.success + '15', color: colors.success, fontWeight: 700,
                  }}>응답 {f.responseRate}%</span>
                  <span style={{
                    fontSize: (14 + fontScale), padding: '2px 6px', borderRadius: 4,
                    background: colors.primary + '15', color: colors.primary, fontWeight: 700,
                  }}>자동성 {Math.round(f.avgAutomaticity*100)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button onClick={() => alert('전체 시설 데이터 CSV 익스포트')} style={{
          marginTop: 16, width: '100%',
          background: colors.a5Color, color: '#fff', border: 'none',
          borderRadius: 12, padding: '14px', fontSize: (18 + fontScale), fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}><Download size={16} /> 전체 시설 데이터 익스포트</button>
      </div>
    </div>
  );

  // A5 사용자 모니터링
  const renderA5Users = () => (
    <div>
      <Header title="사용자 모니터링"
        actorBadge={{ label: 'A5', bg: '#E0E7FF', fg: colors.a5Color }} />
      <div style={{ padding: '16px 14px 100px' }}>
        <div style={{
          background: colors.surface, border: `1px solid ${colors.border}`,
          borderRadius: 12, padding: '12px 14px', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Search size={18} color={colors.textSub} />
          <span style={{ fontSize: (17 + fontScale), color: colors.textSub, flex: 1 }}>사용자 ID 또는 이름 검색</span>
        </div>

        <h3 style={{ fontSize: (18 + fontScale), fontWeight: 700, margin: '8px 0 10px 4px' }}>가입 추이 (최근 7일)</h3>
        <div style={{
          background: colors.surface, border: `1px solid ${colors.border}`,
          borderRadius: 12, padding: '14px', marginBottom: 14,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: 80, gap: 6 }}>
            {[42, 51, 38, 67, 55, 73, 89].map((v, i) => {
              const max = 89;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: (14 + fontScale), fontWeight: 700, color: colors.text }}>{v}</span>
                  <div style={{ height: 60, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{
                      width: '100%', height: `${(v/max)*100}%`,
                      background: colors.a5Color, borderRadius: 4,
                    }} />
                  </div>
                  <span style={{ fontSize: (14 + fontScale), color: colors.textSub }}>{['월','화','수','목','금','토','일'][i]}</span>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: (15 + fontScale), color: colors.textSub, margin: '10px 0 0', textAlign: 'center' }}>
            7일 합계 415명 · 일평균 59명
          </p>
        </div>

        <h3 style={{ fontSize: (18 + fontScale), fontWeight: 700, margin: '0 0 10px 4px' }}>이상 패턴 감지</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { type: '비활성', desc: '7일 이상 미활성 사용자 124명', color: colors.warning, icon: AlertCircle },
            { type: '응급 다발', desc: '경기 분당 지역 응급 신고 +40%', color: colors.danger, icon: AlertTriangle },
            { type: '신규', desc: '강원도 신규 시설 3곳 합류', color: colors.success, icon: Plus },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} style={{
                background: colors.surface, border: `1px solid ${colors.border}`,
                borderLeft: `4px solid ${item.color}`,
                borderRadius: 10, padding: '12px 14px',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <Icon size={18} color={item.color} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: (16 + fontScale), fontWeight: 700, margin: 0, color: item.color }}>{item.type}</p>
                  <p style={{ fontSize: (17 + fontScale), margin: '2px 0 0' }}>{item.desc}</p>
                </div>
                <ChevronRight size={16} color={colors.textSub} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ===========================================
  // ============ 탭바 ==========================
  // ===========================================
  const renderTabBar = () => {
    const tabsByActor = {
      A1: [
        { id: 'home', icon: Home, label: '홈' },
        { id: 'progress', icon: TrendingUp, label: '진행률' },
        { id: 'checkup', icon: Stethoscope, label: '검진' },
        { id: 'settings', icon: Settings, label: '설정' },
      ],
      A2: [
        { id: 'home', icon: Home, label: '홈' },
        { id: 'report', icon: TrendingUp, label: '리포트' },
        { id: 'alerts', icon: Bell, label: '알림' },
        { id: 'settings', icon: Settings, label: '설정' },
      ],
      A3: [
        { id: 'home', icon: Users, label: '담당' },
        { id: 'stats', icon: BarChart3, label: '통계' },
        { id: 'handover', icon: FileText, label: '인계' },
        { id: 'settings', icon: Settings, label: '설정' },
      ],
      A5: [
        { id: 'home', icon: Home, label: '대시보드' },
        { id: 'facilities', icon: Building2, label: '시설' },
        { id: 'users', icon: Users, label: '사용자' },
        { id: 'settings', icon: Settings, label: '설정' },
      ],
    };
    const tabs = tabsByActor[actor] || [];
    const tabColor = actor === 'A2' ? colors.a2Color
                   : actor === 'A3' ? colors.a3Color
                   : actor === 'A5' ? colors.a5Color
                   : colors.primary;

    return (
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: colors.surface, borderTop: `1px solid ${colors.border}`,
        display: 'flex', paddingBottom: 8, paddingTop: 6,
      }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = screen === tab.id;
          const color = tab.danger ? colors.danger : (active ? tabColor : colors.textSub);
          return (
            <button key={tab.id} onClick={() => { setScreen(tab.id); setSelectedElder(null); }} style={{
              flex: 1, background: 'transparent', border: 'none',
              padding: '8px 4px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color,
            }}>
              <Icon size={24} strokeWidth={active ? 2.5 : 2} />
              <span style={{ fontSize: (15 + fontScale), fontWeight: active ? 700 : 500 }}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    );
  };

  // ===========================================
  // ============ 라우터 ========================
  // ===========================================
  const renderScreen = () => {
    // 저장된 데이터 불러오는 중 (v8 신규)
    if (!isLoaded) {
      return (
        <div style={{
          background: `linear-gradient(135deg, #1E5F74 0%, #0F3B47 100%)`,
          minHeight: '100%', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', color: '#fff', gap: 20,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}>
            <Heart size={32} fill="#fff" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: (22 + fontScale), fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
              DentureCare
            </p>
            <p style={{ fontSize: (16 + fontScale), opacity: 0.75, margin: '4px 0 0' }}>
              저장된 정보를 불러오는 중...
            </p>
          </div>
        </div>
      );
    }

    // 첫 진입 또는 명시적 전환 시 액터 선택 화면
    if (!actor || showActorSwitch) return renderActorSelect({ isSwitch: showActorSwitch });

    // 온보딩 진행 중이면 마법사 화면
    if (onboardingStep > 0) return renderOnboarding();

    // A1 노인
    if (actor === 'A1') {
      if (screen === 'action') return renderA1Action();
      if (screen === 'checkup') return renderA1Checkup();
      if (screen === 'progress') return renderA1Progress();
      if (screen === 'settings') return renderSettingsScreen({ actorColor: colors.a1Color, actorLabel: "A1 노인 본인" });
      return renderA1Home();
    }

    // A2 가족
    if (actor === 'A2') {
      if (screen === 'report') return renderA2Report();
      if (screen === 'alerts') return renderA2Alerts();
      if (screen === 'settings') return renderSettingsScreen({ actorColor: colors.a2Color, actorLabel: "A2 가족 보호자" });
      return renderA2Home();
    }

    // A3 요양보호사
    if (actor === 'A3') {
      if (screen === 'elderDetail' && selectedElder) return renderA3ElderDetail();
      if (screen === 'stats') return renderA3FacilityStats();
      if (screen === 'handover') return renderA3Handover();
      if (screen === 'settings') return renderSettingsScreen({ actorColor: colors.a3Color, actorLabel: "A3 요양보호사" });
      return renderA3ElderList();
    }

    // A5 시스템 관리자
    if (actor === 'A5') {
      if (screen === 'facilities') return renderA5Facilities();
      if (screen === 'users') return renderA5Users();
      if (screen === 'settings') return renderSettingsScreen({ actorColor: colors.a5Color, actorLabel: "A5 시스템 관리자" });
      return renderA5Dashboard();
    }
  };

  const showTabBar = actor && !showActorSwitch
    && onboardingStep === 0
    && screen !== 'action'
    && !(actor === 'A3' && screen === 'elderDetail');

  // 현재 액터 라벨
  const actorBgMap = { A1: '#06B6D4', A2: '#F472B6', A3: '#34D399', A5: '#A5B4FC' };
  const actorLabelMap = { A1: '노인', A2: '가족', A3: '요양보호사', A5: '관리자' };

  return (
    <div style={{
      minHeight: '100vh', background: '#E5E7EB',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px 12px', ...baseStyle,
    }}>
      <div style={{
        width: '100%', maxWidth: 420,
        background: actor ? colors.bg : '#0F3B47',
        borderRadius: 28,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        overflow: 'hidden', position: 'relative',
        height: '90vh', maxHeight: 880,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* 액터 표시 (온보딩 중에는 숨김) */}
        {actor && !showActorSwitch && onboardingStep === 0 && (
          <div style={{
            position: 'absolute', top: 10, right: 10, zIndex: 20,
            background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)',
            color: '#fff', borderRadius: 99, padding: '4px 10px',
            fontSize: (14 + fontScale), fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 5,
            border: `1px solid ${actorBgMap[actor]}40`,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: actorBgMap[actor],
            }} />
            {actor} {actorLabelMap[actor]} 모드
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {renderScreen()}
        </div>
        {showTabBar && renderTabBar()}

        {/* ★ 틀니 제작시기 수정 확인 다이얼로그 (v5) */}
        {showDentureDateConfirm && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, zIndex: 100,
          }}>
            <div style={{
              background: colors.surface, borderRadius: 18,
              padding: '24px 22px', maxWidth: 340,
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: '#FEF3C7', color: '#92400E',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px',
              }}>
                <AlertCircle size={28} />
              </div>
              <h3 style={{
                fontSize: (22 + fontScale), fontWeight: 800, margin: '0 0 8px',
                textAlign: 'center', color: colors.text,
              }}>
                틀니 제작시기를 수정하시겠어요?
              </h3>
              <p style={{
                fontSize: (17 + fontScale), color: colors.textSub, margin: '0 0 18px',
                textAlign: 'center', lineHeight: 1.6,
              }}>
                이 정보를 바꾸면<br />
                <strong style={{ color: colors.danger }}>다음 검진 일정이 다시 계산</strong>돼요.<br />
                정확한 시기로 입력해주세요.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setShowDentureDateConfirm(false)}
                  style={{
                    flex: 1, padding: '14px',
                    background: '#fff', color: colors.textSub,
                    border: `1px solid ${colors.border}`, borderRadius: 10,
                    fontSize: (18 + fontScale), fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  취소
                </button>
                <button
                  onClick={() => {
                    setShowDentureDateConfirm(false);
                    alert('수정 화면으로 이동\n(프로토타입에서는 미구현)');
                  }}
                  style={{
                    flex: 1, padding: '14px',
                    background: colors.danger, color: '#fff',
                    border: 'none', borderRadius: 10,
                    fontSize: (18 + fontScale), fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  수정할게요
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ★ 데이터 초기화 확인 다이얼로그 (v8) */}
        {showResetConfirm && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, zIndex: 100,
          }}>
            <div style={{
              background: colors.surface, borderRadius: 18,
              padding: '24px 22px', maxWidth: 340,
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: '#FEF2F2', color: colors.danger,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px',
              }}>
                <AlertTriangle size={28} />
              </div>
              <h3 style={{
                fontSize: (22 + fontScale), fontWeight: 800, margin: '0 0 8px',
                textAlign: 'center', color: colors.text,
              }}>
                정말 모든 데이터를<br />삭제하시겠어요?
              </h3>
              <p style={{
                fontSize: (17 + fontScale), color: colors.textSub, margin: '0 0 18px',
                textAlign: 'center', lineHeight: 1.6,
              }}>
                <strong style={{ color: colors.danger }}>환자 정보, 검진 일정 등이<br />모두 사라집니다.</strong><br />
                이 작업은 되돌릴 수 없어요.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  style={{
                    flex: 1, padding: '14px',
                    background: '#fff', color: colors.textSub,
                    border: `1px solid ${colors.border}`, borderRadius: 10,
                    fontSize: (18 + fontScale), fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  취소
                </button>
                <button
                  onClick={async () => {
                    setShowResetConfirm(false);
                    await clearData();
                    setOnboardingData({
                      name: '', birthYear: '', phone: '',
                      dentureMadeYear: '', dentureMadeMonth: '',
                      dentalClinic: '', dentalClinicPhone: '',
                      notificationTimes: { wake: '07:00', meal1: '08:00', meal2: '12:30', meal3: '19:00', sleep: '22:30' },
                      inviteCode: '',
                      permissions: { notification: true, location: false, camera: false },
                    });
                    setHasOnboarded(false);
                    setActor(null);
                  }}
                  style={{
                    flex: 1, padding: '14px',
                    background: colors.danger, color: '#fff',
                    border: 'none', borderRadius: 10,
                    fontSize: (18 + fontScale), fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  모두 삭제
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ★ v9 리콜 임박 팝업 알람 시스템 */}
        {recallPopup && (() => {
          const stage = recallPopup.stage;
          const dDay = recallPopup.dDay;
          const name = onboardingData.name || '어르신';
          const clinic = onboardingData.dentalClinic || '단골 치과';
          const phone = onboardingData.dentalClinicPhone || '';

          // 단계별 색상·메시지 정의
          const config = {
            d_14: {
              color: '#D97706', bg: '#FFFBEB', border: '#FCD34D',
              icon: '📅', title: '검진이 다가오고 있어요',
              message: `${name}님, 안녕하세요.\n다음 검진까지 2주 남았어요.\n미리 예약하시면 원하는 시간에 받으실 수 있어요.`,
            },
            d_7: {
              color: '#EA580C', bg: '#FFF7ED', border: '#FB923C',
              icon: '📅', title: '이번 주에 검진 받으러 오세요',
              message: `${name}님, 이번 주에 검진이 있어요.\n아직 예약 안 하셨다면 지금이 좋아요.`,
            },
            d_3: {
              color: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5',
              icon: '🔔', title: `검진 ${dDay}일 남았어요!`,
              message: `${name}님, ${dDay}일 뒤 검진 받으러 오시는 날이에요.\n예약 확인하셨나요?`,
            },
            d_day: {
              color: '#991B1B', bg: '#FEE2E2', border: '#F87171',
              icon: '🏥', title: '오늘 검진 받으러 가시는 날이에요',
              message: `${name}님, 오늘 검진 받으러 가시는 날이에요.\n틀니를 깨끗이 닦고 가져가세요.\n\n조심히 다녀오세요.`,
            },
            after: {
              color: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD',
              icon: '💜', title: '검진 다녀오셨어요?',
              message: `${name}님, 며칠 전 검진 받으러 가시는 날이었어요.\n잘 다녀오셨나요?`,
            },
          };
          const c = config[stage];

          // 무상 점검 안내 표시 여부 (틀니 만든 지 3개월 이내, d_14·d_7만)
          const showFreeInfo = recallInfo && recallInfo.monthsSince < 3 && (stage === 'd_14' || stage === 'd_7');
          // 보험 안내 표시 여부 (만 65세 이상, 3개월 이후, d_7·d_3만)
          const age = onboardingData.birthYear
            ? new Date().getFullYear() - parseInt(onboardingData.birthYear)
            : 0;
          const showInsurance = age >= 65 && recallInfo && recallInfo.monthsSince >= 3 && (stage === 'd_7' || stage === 'd_3');

          const closePopup = () => setRecallPopup(null);
          const dismissToday = () => {
            const todayStr = new Date().toISOString().split('T')[0];
            setPopupDismissedToday(todayStr);
            setRecallPopup(null);
          };
          const handleVisited = () => {
            // 다녀왔어요 - 새 검진 기준일로 업데이트
            const today = new Date();
            setLastCheckupDate(today.toISOString());
            setRecallPopup(null);
            // 환자에게 확인 메시지
            alert(`${name}님, 검진 잘 다녀오셨어요!\n다음 검진 일정이 새로 계산되었어요.`);
          };

          return (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 20, zIndex: 200,
            }}>
              <div style={{
                background: '#fff', borderRadius: 20,
                maxWidth: 360, width: '100%',
                boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                overflow: 'hidden',
              }}>
                {/* 컬러 헤더 */}
                <div style={{
                  background: c.bg,
                  borderBottom: `3px solid ${c.border}`,
                  padding: '24px 20px 18px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: (48 + fontScale), marginBottom: 6 }}>{c.icon}</div>
                  <h3 style={{
                    fontSize: (23 + fontScale), fontWeight: 800, margin: 0,
                    color: c.color, letterSpacing: '-0.02em',
                  }}>
                    {c.title}
                  </h3>
                </div>

                {/* 본문 */}
                <div style={{ padding: '20px 22px' }}>
                  <p style={{
                    fontSize: (19 + fontScale), color: '#1F2937', margin: 0, lineHeight: 1.7,
                    whiteSpace: 'pre-line',
                  }}>
                    {c.message}
                  </p>

                  {/* 무상 점검 안내 */}
                  {showFreeInfo && (
                    <div style={{
                      marginTop: 14, padding: '12px 14px',
                      background: '#DCFCE7', border: '1px solid #86EFAC',
                      borderRadius: 10,
                    }}>
                      <p style={{ fontSize: (17 + fontScale), fontWeight: 700, color: '#15803D', margin: '0 0 4px' }}>
                        💚 무상 유지관리 기간이에요
                      </p>
                      <p style={{ fontSize: (16 + fontScale), color: '#166534', margin: 0, lineHeight: 1.6 }}>
                        틀니 만든 후 3개월 동안은 6번까지 무상 점검 가능해요.
                        진찰료만 내시면 돼요.
                      </p>
                    </div>
                  )}

                  {/* 보험 안내 */}
                  {showInsurance && (
                    <div style={{
                      marginTop: 14, padding: '12px 14px',
                      background: '#DBEAFE', border: '1px solid #93C5FD',
                      borderRadius: 10,
                    }}>
                      <p style={{ fontSize: (17 + fontScale), fontWeight: 700, color: '#1E40AF', margin: '0 0 4px' }}>
                        💙 건강보험 유지관리 가능
                      </p>
                      <p style={{ fontSize: (16 + fontScale), color: '#1E3A8A', margin: 0, lineHeight: 1.6 }}>
                        만 65세 이상은 건강보험으로 받으실 수 있어요. (본인부담 30%)
                        자세한 횟수는 치과에서 안내해드려요.
                      </p>
                    </div>
                  )}

                  {/* 치과 정보 (D-3, D-day) */}
                  {(stage === 'd_3' || stage === 'd_day') && phone && (
                    <div style={{
                      marginTop: 14, padding: '12px 14px',
                      background: '#F9FAFB', border: `1px solid #E5E7EB`,
                      borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <Phone size={16} color={c.color} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: (17 + fontScale), fontWeight: 700, margin: 0, color: '#111827' }}>
                          {clinic}
                        </p>
                        <p style={{ fontSize: (16 + fontScale), color: '#6B7280', margin: '2px 0 0' }}>
                          {phone}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 버튼 영역 */}
                <div style={{
                  padding: '12px 18px 18px',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  {/* 후속 팝업 (D+1) - 3가지 응답 버튼 */}
                  {stage === 'after' ? (
                    <>
                      <button onClick={handleVisited} style={{
                        width: '100%', padding: '14px',
                        background: c.color, color: '#fff', border: 'none',
                        borderRadius: 12, fontSize: (19 + fontScale), fontWeight: 700, cursor: 'pointer',
                      }}>
                        ✓ 네, 다녀왔어요
                      </button>
                      <button onClick={closePopup} style={{
                        width: '100%', padding: '12px',
                        background: '#fff', color: '#6B7280',
                        border: '1px solid #D1D5DB', borderRadius: 12,
                        fontSize: (18 + fontScale), fontWeight: 600, cursor: 'pointer',
                      }}>
                        오늘 갈 거예요
                      </button>
                      <button onClick={closePopup} style={{
                        width: '100%', padding: '12px',
                        background: 'transparent', color: '#9CA3AF',
                        border: 'none', fontSize: (17 + fontScale), fontWeight: 500, cursor: 'pointer',
                      }}>
                        아직 못 갔어요
                      </button>
                    </>
                  ) : stage === 'd_day' ? (
                    <>
                      <button onClick={handleVisited} style={{
                        width: '100%', padding: '14px',
                        background: c.color, color: '#fff', border: 'none',
                        borderRadius: 12, fontSize: (19 + fontScale), fontWeight: 700, cursor: 'pointer',
                      }}>
                        🏥 다녀왔어요
                      </button>
                      {phone && (
                        <button onClick={() => alert(`${clinic}\n📞 ${phone}\n\n전화 연결...`)} style={{
                          width: '100%', padding: '12px',
                          background: '#fff', color: c.color,
                          border: `1px solid ${c.border}`, borderRadius: 12,
                          fontSize: (18 + fontScale), fontWeight: 600, cursor: 'pointer',
                        }}>
                          📞 치과 전화
                        </button>
                      )}
                      <button onClick={closePopup} style={{
                        width: '100%', padding: '10px',
                        background: 'transparent', color: '#9CA3AF',
                        border: 'none', fontSize: (17 + fontScale), fontWeight: 500, cursor: 'pointer',
                      }}>
                        확인했어요
                      </button>
                    </>
                  ) : (
                    <>
                      {phone && (
                        <button onClick={() => alert(`${clinic}\n📞 ${phone}\n\n예약 전화 연결...`)} style={{
                          width: '100%', padding: '14px',
                          background: c.color, color: '#fff', border: 'none',
                          borderRadius: 12, fontSize: (19 + fontScale), fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}>
                          <Phone size={18} /> 예약 전화하기
                        </button>
                      )}
                      <button onClick={closePopup} style={{
                        width: '100%', padding: '12px',
                        background: '#fff', color: '#6B7280',
                        border: '1px solid #D1D5DB', borderRadius: 12,
                        fontSize: (18 + fontScale), fontWeight: 600, cursor: 'pointer',
                      }}>
                        확인했어요
                      </button>
                      <button onClick={dismissToday} style={{
                        width: '100%', padding: '10px',
                        background: 'transparent', color: '#9CA3AF',
                        border: 'none', fontSize: (16 + fontScale), fontWeight: 500, cursor: 'pointer',
                      }}>
                        오늘은 그만 보기
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ★ v10 자가 보고 메뉴 (홈의 "불편한 곳이 있으세요?" 누르면) */}
        {showReportMenu && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            zIndex: 150,
          }}>
            <div style={{
              background: '#fff',
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              width: '100%', maxHeight: '70%',
              padding: '20px 18px 24px',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
              overflowY: 'auto',
            }}>
              <div style={{
                width: 40, height: 4, background: '#E5E7EB',
                borderRadius: 99, margin: '0 auto 16px',
              }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h2 style={{ fontSize: (24 + fontScale), fontWeight: 800, margin: 0, color: colors.text }}>
                  어떤 일이 있으세요?
                </h2>
                <button onClick={() => setShowReportMenu(false)} style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: colors.textSub, padding: 4,
                }}>
                  <X size={24} />
                </button>
              </div>

              <p style={{ fontSize: (17 + fontScale), color: colors.textSub, margin: '0 0 16px', lineHeight: 1.5 }}>
                불편한 부분을 알려주시면 어떻게 해야 할지 안내해드려요.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {reportableAlerts.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setShowReportMenu(false);
                      setGeneralAlert({ ...alertDefinitions[item.id], alertId: item.id });
                    }}
                    style={{
                      background: '#fff', border: `2px solid ${item.color}40`,
                      borderRadius: 14, padding: '16px',
                      display: 'flex', alignItems: 'center', gap: 14,
                      cursor: 'pointer', textAlign: 'left',
                    }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: item.color + '15', color: item.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: (30 + fontScale), flexShrink: 0,
                    }}>
                      {item.icon}
                    </div>
                    <span style={{ fontSize: (20 + fontScale), fontWeight: 700, color: colors.text, flex: 1 }}>
                      {item.label}
                    </span>
                    <ChevronRight size={20} color={colors.textSub} />
                  </button>
                ))}
              </div>

              {/* 미수행 알람 시뮬레이션 (테스트용) */}
              <div style={{
                marginTop: 20, padding: '14px',
                background: '#F9FAFB', border: `1px dashed ${colors.border}`,
                borderRadius: 10,
              }}>
                <p style={{ fontSize: (15 + fontScale), fontWeight: 700, color: colors.textSub, margin: '0 0 8px' }}>
                  🧪 테스트용 — 미수행 알람 미리보기
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { id: 'missed_1day', label: '1일 미수행' },
                    { id: 'missed_3days', label: '3일 미수행' },
                    { id: 'sleep_with_denture', label: '취침 보관' },
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setShowReportMenu(false);
                        setGeneralAlert({ ...alertDefinitions[t.id], alertId: t.id });
                      }}
                      style={{
                        background: '#fff', border: `1px solid ${colors.border}`,
                        borderRadius: 8, padding: '6px 12px',
                        fontSize: (16 + fontScale), cursor: 'pointer', color: colors.text,
                      }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ★ v10 일반 알람 팝업 (응급·미수행 통합) */}
        {generalAlert && (() => {
          const a = generalAlert;
          const clinic = onboardingData.dentalClinic || '단골 치과';
          const phone = onboardingData.dentalClinicPhone || '';
          const closeAlert = () => setGeneralAlert(null);
          const callClinic = () => {
            if (phone) alert(`${clinic}\n📞 ${phone}\n\n전화 연결...`);
            closeAlert();
          };

          return (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 20, zIndex: 200,
            }}>
              <div style={{
                background: '#fff', borderRadius: 20,
                maxWidth: 360, width: '100%',
                boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                overflow: 'hidden',
                maxHeight: '90vh',
                display: 'flex', flexDirection: 'column',
              }}>
                {/* 헤더 */}
                <div style={{
                  background: a.bg,
                  borderBottom: `3px solid ${a.border}`,
                  padding: '22px 20px 16px',
                  textAlign: 'center',
                  position: 'relative',
                }}>
                  <button onClick={closeAlert} style={{
                    position: 'absolute', top: 10, right: 10,
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: a.color, padding: 4,
                  }}>
                    <X size={20} />
                  </button>
                  <div style={{ fontSize: (44 + fontScale), marginBottom: 4 }}>{a.emoji}</div>
                  <h3 style={{
                    fontSize: (22 + fontScale), fontWeight: 800, margin: 0,
                    color: a.color, letterSpacing: '-0.02em',
                    lineHeight: 1.4,
                  }}>
                    {a.title}
                  </h3>
                </div>

                {/* 본문 */}
                <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1 }}>
                  <p style={{
                    fontSize: (18 + fontScale), color: '#1F2937', margin: 0, lineHeight: 1.7,
                    whiteSpace: 'pre-line',
                  }}>
                    {a.message}
                  </p>

                  {/* 경고 사항 */}
                  {a.warnings && a.warnings.length > 0 && (
                    <div style={{
                      marginTop: 14, padding: '12px 14px',
                      background: '#FEF2F2', border: '1px solid #FECACA',
                      borderRadius: 10,
                    }}>
                      <p style={{ fontSize: (16 + fontScale), fontWeight: 700, color: '#991B1B', margin: '0 0 8px' }}>
                        ⚠️ 이렇게 하지 마세요
                      </p>
                      {a.warnings.map((w, i) => (
                        <p key={i} style={{
                          fontSize: (16 + fontScale), color: '#7F1D1D', margin: '4px 0', lineHeight: 1.5,
                          paddingLeft: 14, position: 'relative',
                        }}>
                          <span style={{ position: 'absolute', left: 0 }}>❌</span>
                          {w}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* 팁 */}
                  {a.tip && (
                    <div style={{
                      marginTop: 12, padding: '10px 14px',
                      background: '#DCFCE7', border: '1px solid #86EFAC',
                      borderRadius: 10,
                      display: 'flex', gap: 8,
                    }}>
                      <span style={{ fontSize: (20 + fontScale) }}>💡</span>
                      <p style={{ fontSize: (16 + fontScale), color: '#166534', margin: 0, lineHeight: 1.6 }}>
                        {a.tip}
                      </p>
                    </div>
                  )}

                  {/* 치과 정보 (응급 알람일 때) */}
                  {(a.severity === 'high' || a.severity === 'medium') && phone && a.alertId !== 'missed_1day' && (
                    <div style={{
                      marginTop: 12, padding: '12px 14px',
                      background: '#F9FAFB', border: `1px solid #E5E7EB`,
                      borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <Phone size={16} color={a.color} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: (17 + fontScale), fontWeight: 700, margin: 0, color: '#111827' }}>
                          {clinic}
                        </p>
                        <p style={{ fontSize: (16 + fontScale), color: '#6B7280', margin: '2px 0 0' }}>
                          {phone}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 버튼 영역 */}
                <div style={{
                  padding: '12px 18px 18px',
                  display: 'flex', flexDirection: 'column', gap: 8,
                  borderTop: '1px solid #F3F4F6',
                }}>
                  {/* 응급 (high) - 전화 우선 */}
                  {a.severity === 'high' && phone && a.alertId !== 'missed_3days' ? (
                    <>
                      <button onClick={callClinic} style={{
                        width: '100%', padding: '14px',
                        background: a.color, color: '#fff', border: 'none',
                        borderRadius: 12, fontSize: (19 + fontScale), fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}>
                        <Phone size={18} /> {a.primaryButton}
                      </button>
                      <button onClick={closeAlert} style={{
                        width: '100%', padding: '10px',
                        background: 'transparent', color: '#9CA3AF',
                        border: 'none', fontSize: (17 + fontScale), fontWeight: 500, cursor: 'pointer',
                      }}>
                        나중에 보기
                      </button>
                    </>
                  ) : a.alertId === 'missed_3days' ? (
                    <>
                      <button onClick={closeAlert} style={{
                        width: '100%', padding: '14px',
                        background: a.color, color: '#fff', border: 'none',
                        borderRadius: 12, fontSize: (19 + fontScale), fontWeight: 700, cursor: 'pointer',
                      }}>
                        {a.primaryButton}
                      </button>
                      {phone && (
                        <button onClick={callClinic} style={{
                          width: '100%', padding: '12px',
                          background: '#fff', color: a.color,
                          border: `1px solid ${a.border}`, borderRadius: 12,
                          fontSize: (18 + fontScale), fontWeight: 600, cursor: 'pointer',
                        }}>
                          📞 {a.secondaryButton}
                        </button>
                      )}
                    </>
                  ) : a.alertId === 'sleep_with_denture' ? (
                    <>
                      <button onClick={closeAlert} style={{
                        width: '100%', padding: '14px',
                        background: a.color, color: '#fff', border: 'none',
                        borderRadius: 12, fontSize: (19 + fontScale), fontWeight: 700, cursor: 'pointer',
                      }}>
                        {a.primaryButton}
                      </button>
                      <button onClick={closeAlert} style={{
                        width: '100%', padding: '10px',
                        background: 'transparent', color: '#9CA3AF',
                        border: 'none', fontSize: (17 + fontScale), fontWeight: 500, cursor: 'pointer',
                      }}>
                        {a.secondaryButton}
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={closeAlert} style={{
                        width: '100%', padding: '14px',
                        background: a.color, color: '#fff', border: 'none',
                        borderRadius: 12, fontSize: (19 + fontScale), fontWeight: 700, cursor: 'pointer',
                      }}>
                        {a.primaryButton}
                      </button>
                      {a.severity !== 'low' && phone && (
                        <button onClick={callClinic} style={{
                          width: '100%', padding: '12px',
                          background: '#fff', color: a.color,
                          border: `1px solid ${a.border}`, borderRadius: 12,
                          fontSize: (18 + fontScale), fontWeight: 600, cursor: 'pointer',
                        }}>
                          📞 치과 전화
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ★ v11 틀니 제작시기 수정 다이얼로그 */}
        {showDentureDateEdit && (() => {
          const currentYear = new Date().getFullYear();
          const years = [];
          for (let y = currentYear; y >= currentYear - 20; y--) years.push(y);
          const months = Array.from({ length: 12 }, (_, i) => i + 1);
          const canSave = editYear && editMonth;

          // 미리보기 계산
          const preview = canSave ? calculateRecall(editYear, editMonth) : null;

          // 빠른 테스트 프리셋 (D-day 시기별)
          const today = new Date();
          const setPresetMonthsAgo = (months, addDays = 0) => {
            const d = new Date(today);
            d.setMonth(d.getMonth() - months);
            d.setDate(d.getDate() - addDays);
            setEditYear(String(d.getFullYear()));
            setEditMonth(String(d.getMonth() + 1));
          };

          const handleSave = () => {
            setOnboardingData({
              ...onboardingData,
              dentureMadeYear: editYear,
              dentureMadeMonth: editMonth,
            });
            // 팝업 차단 상태 초기화 (새 일정 기준으로 다시 떠야 함)
            setPopupDismissedToday(null);
            setLastCheckupDate(null);
            setShowDentureDateEdit(false);
            // 검진 일정이 새로 계산되었음을 알림
            setTimeout(() => {
              alert(`틀니 제작시기가 ${editYear}년 ${editMonth}월로 변경되었어요.\n다음 검진 일정이 새로 계산됩니다.`);
            }, 200);
          };

          return (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 16, zIndex: 250,
            }}>
              <div style={{
                background: '#fff', borderRadius: 18,
                maxWidth: 380, width: '100%',
                maxHeight: '90vh',
                boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
              }}>
                {/* 헤더 */}
                <div style={{
                  padding: '20px 22px 14px',
                  borderBottom: `1px solid ${colors.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10,
                      background: '#FEF3C7', color: '#92400E',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Calendar size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: (21 + fontScale), fontWeight: 800, margin: 0 }}>
                        틀니 제작시기 수정
                      </h3>
                      <p style={{ fontSize: (15 + fontScale), color: colors.textSub, margin: '2px 0 0' }}>
                        검진 일정이 자동으로 다시 계산돼요
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setShowDentureDateEdit(false)} style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: colors.textSub, padding: 4,
                  }}>
                    <X size={22} />
                  </button>
                </div>

                {/* 본문 */}
                <div style={{ padding: '16px 22px', overflowY: 'auto', flex: 1 }}>
                  {/* 현재 설정 + 진단 정보 */}
                  <div style={{
                    background: '#F9FAFB', borderRadius: 10,
                    padding: '12px 14px', marginBottom: 14,
                    fontSize: (16 + fontScale),
                  }}>
                    <div style={{ color: colors.textSub, marginBottom: 6 }}>
                      <strong style={{ color: colors.text }}>현재 설정:</strong> {onboardingData.dentureMadeYear && onboardingData.dentureMadeMonth
                        ? `${onboardingData.dentureMadeYear}년 ${onboardingData.dentureMadeMonth}월`
                        : '❌ 미등록 (팝업 안 뜸!)'}
                    </div>
                    {recallInfo && (
                      <>
                        <div style={{ color: colors.textSub }}>
                          <strong style={{ color: colors.text }}>현재 D-day:</strong>{' '}
                          <span style={{
                            color: recallInfo.dDay <= 14 ? '#DC2626' : colors.textSub,
                            fontWeight: 700,
                          }}>
                            D-{recallInfo.dDay} ({recallInfo.phase})
                          </span>
                        </div>
                        <div style={{ color: colors.textSub, fontSize: (15 + fontScale), marginTop: 4 }}>
                          {recallInfo.dDay > 14
                            ? '⚠️ D-day가 14일을 넘어서 자동 팝업 안 떠요. 아래 "빠른 테스트" 또는 "팝업 즉시 띄우기" 사용하세요!'
                            : '✅ 자동 팝업 트리거 가능 시기예요'}
                        </div>
                      </>
                    )}
                  </div>

                  {/* 빠른 테스트 프리셋 */}
                  <div style={{
                    background: '#EEF2FF', border: '1px dashed #C7D2FE',
                    borderRadius: 10, padding: '12px 14px', marginBottom: 12,
                  }}>
                    <p style={{ fontSize: (15 + fontScale), fontWeight: 700, color: '#4338CA', margin: '0 0 8px' }}>
                      🧪 빠른 테스트 (팝업 시기 미리보기)
                    </p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => setPresetMonthsAgo(6, 14)} style={{
                        background: '#fff', border: '1px solid #C7D2FE',
                        borderRadius: 6, padding: '6px 10px',
                        fontSize: (15 + fontScale), cursor: 'pointer', color: '#4338CA', fontWeight: 600,
                      }}>D-14 (안정기)</button>
                      <button onClick={() => setPresetMonthsAgo(6, 21)} style={{
                        background: '#fff', border: '1px solid #FCD34D',
                        borderRadius: 6, padding: '6px 10px',
                        fontSize: (15 + fontScale), cursor: 'pointer', color: '#92400E', fontWeight: 600,
                      }}>D-7</button>
                      <button onClick={() => setPresetMonthsAgo(6, 27)} style={{
                        background: '#fff', border: '1px solid #FCA5A5',
                        borderRadius: 6, padding: '6px 10px',
                        fontSize: (15 + fontScale), cursor: 'pointer', color: '#B91C1C', fontWeight: 600,
                      }}>D-3</button>
                      <button onClick={() => setPresetMonthsAgo(6, 30)} style={{
                        background: '#fff', border: '1px solid #F87171',
                        borderRadius: 6, padding: '6px 10px',
                        fontSize: (15 + fontScale), cursor: 'pointer', color: '#991B1B', fontWeight: 600,
                      }}>D-day</button>
                      <button onClick={() => setPresetMonthsAgo(6, 32)} style={{
                        background: '#fff', border: '1px solid #C4B5FD',
                        borderRadius: 6, padding: '6px 10px',
                        fontSize: (15 + fontScale), cursor: 'pointer', color: '#7C3AED', fontWeight: 600,
                      }}>D+2 (지난 후)</button>
                    </div>
                  </div>

                  {/* ★ v11.1 팝업 즉시 띄우기 (디버깅용) */}
                  <div style={{
                    background: '#FEF2F2', border: '1px dashed #FCA5A5',
                    borderRadius: 10, padding: '12px 14px', marginBottom: 12,
                  }}>
                    <p style={{ fontSize: (15 + fontScale), fontWeight: 700, color: '#B91C1C', margin: '0 0 4px' }}>
                      ⚡ 검진 팝업 즉시 띄우기 (저장 없이 미리보기)
                    </p>
                    <p style={{ fontSize: (14 + fontScale), color: '#7F1D1D', margin: '0 0 8px' }}>
                      위 "변경하기" 누르기 전이라도 팝업을 바로 볼 수 있어요
                    </p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {[
                        { stage: 'd_14', dDay: 14, label: 'D-14', color: '#D97706' },
                        { stage: 'd_7', dDay: 7, label: 'D-7', color: '#EA580C' },
                        { stage: 'd_3', dDay: 3, label: 'D-3', color: '#DC2626' },
                        { stage: 'd_day', dDay: 0, label: 'D-day', color: '#991B1B' },
                        { stage: 'after', dDay: -2, label: 'D+2', color: '#7C3AED' },
                      ].map(p => (
                        <button
                          key={p.stage}
                          onClick={() => {
                            setShowDentureDateEdit(false);
                            setTimeout(() => setRecallPopup({ stage: p.stage, dDay: p.dDay }), 200);
                          }}
                          style={{
                            background: p.color, color: '#fff', border: 'none',
                            borderRadius: 6, padding: '7px 12px',
                            fontSize: (15 + fontScale), cursor: 'pointer', fontWeight: 700,
                          }}
                        >
                          {p.label} 보기
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ★ v12 일일 정보 팝업 테스트 */}
                  <div style={{
                    background: '#DBEAFE', border: '1px dashed #93C5FD',
                    borderRadius: 10, padding: '12px 14px', marginBottom: 16,
                  }}>
                    <p style={{ fontSize: (15 + fontScale), fontWeight: 700, color: '#1E40AF', margin: '0 0 4px' }}>
                      💡 일일 정보 팝업 테스트
                    </p>
                    <p style={{ fontSize: (14 + fontScale), color: '#1E3A8A', margin: '0 0 8px' }}>
                      매일 앱 켜면 랜덤으로 하나씩 떠요
                    </p>
                    <button
                      onClick={() => {
                        setShowDentureDateEdit(false);
                        const age = onboardingData.birthYear
                          ? new Date().getFullYear() - parseInt(onboardingData.birthYear)
                          : 0;
                        const is65Plus = age >= 65;
                        const available = allInfoPopups.filter(p => !p.requiresAge65 || is65Plus);
                        const randomIdx = Math.floor(Math.random() * available.length);
                        setTimeout(() => {
                          setDailyInfoPopup(available[randomIdx]);
                          setInfoPopupShownDate(null); // 다시 띄울 수 있게 초기화
                        }, 200);
                      }}
                      style={{
                        background: '#1E40AF', color: '#fff', border: 'none',
                        borderRadius: 6, padding: '8px 14px',
                        fontSize: (16 + fontScale), cursor: 'pointer', fontWeight: 700,
                      }}
                    >
                      🎲 랜덤 정보 팝업 보기
                    </button>
                  </div>

                  {/* 연도 선택 */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: (17 + fontScale), fontWeight: 600, display: 'block', marginBottom: 6 }}>
                      제작 연도
                    </label>
                    <select
                      value={editYear}
                      onChange={(e) => setEditYear(e.target.value)}
                      style={{
                        width: '100%', padding: '12px 14px',
                        fontSize: (20 + fontScale), fontFamily: 'inherit',
                        border: `2px solid ${colors.border}`, borderRadius: 10,
                        background: '#fff', boxSizing: 'border-box', outline: 'none',
                        appearance: 'none',
                        backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%234B5563\' stroke-width=\'2\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 12px center',
                        backgroundSize: '18px',
                        paddingRight: 40,
                      }}
                    >
                      <option value="">선택해주세요</option>
                      {years.map(y => <option key={y} value={String(y)}>{y}년</option>)}
                    </select>
                  </div>

                  {/* 월 선택 */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: (17 + fontScale), fontWeight: 600, display: 'block', marginBottom: 6 }}>
                      제작 월
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 5 }}>
                      {months.map(m => (
                        <button
                          key={m}
                          onClick={() => setEditMonth(String(m))}
                          style={{
                            padding: '10px 0',
                            background: editMonth === String(m) ? colors.primary : '#fff',
                            color: editMonth === String(m) ? '#fff' : colors.text,
                            border: `1px solid ${editMonth === String(m) ? colors.primary : colors.border}`,
                            borderRadius: 8,
                            fontSize: (17 + fontScale), fontWeight: 700, cursor: 'pointer',
                          }}
                        >
                          {m}월
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 변경 후 미리보기 */}
                  {preview && (
                    <div style={{
                      background: `linear-gradient(135deg, ${colors.primaryLight} 0%, #DBEAFE 100%)`,
                      border: `2px solid ${colors.primary}`,
                      borderRadius: 12, padding: '14px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <Sparkles size={16} color={colors.primary} />
                        <p style={{ fontSize: (16 + fontScale), fontWeight: 700, margin: 0, color: colors.primary }}>
                          변경 후 일정
                        </p>
                      </div>
                      <div style={{ fontSize: (16 + fontScale), lineHeight: 1.8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: colors.textSub }}>경과 기간</span>
                          <strong>{preview.monthsSince}개월</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: colors.textSub }}>현재 단계</span>
                          <strong style={{ color: colors.primary }}>{preview.phase}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: colors.textSub }}>다음 검진</span>
                          <strong style={{ color: colors.accent }}>
                            D-{preview.dDay} ({preview.nextRecallStr})
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 하단 버튼 */}
                <div style={{
                  padding: '14px 18px',
                  borderTop: `1px solid ${colors.border}`,
                  display: 'flex', gap: 8,
                }}>
                  <button onClick={() => setShowDentureDateEdit(false)} style={{
                    flex: 1, padding: '12px',
                    background: '#fff', color: colors.textSub,
                    border: `1px solid ${colors.border}`, borderRadius: 10,
                    fontSize: (18 + fontScale), fontWeight: 700, cursor: 'pointer',
                  }}>
                    취소
                  </button>
                  <button onClick={handleSave} disabled={!canSave} style={{
                    flex: 2, padding: '12px',
                    background: canSave ? colors.primary : '#CBD5E1',
                    color: '#fff', border: 'none', borderRadius: 10,
                    fontSize: (18 + fontScale), fontWeight: 700,
                    cursor: canSave ? 'pointer' : 'not-allowed',
                  }}>
                    변경하기
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ★ v12 일일 정보 팝업 (하루 한 번 랜덤) */}
        {dailyInfoPopup && (() => {
          const p = dailyInfoPopup;
          const closeInfo = () => setDailyInfoPopup(null);

          return (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 20, zIndex: 220,
            }}>
              <div style={{
                background: '#fff', borderRadius: 20,
                maxWidth: 360, width: '100%',
                boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                overflow: 'hidden',
                maxHeight: '85vh',
                display: 'flex', flexDirection: 'column',
              }}>
                {/* 헤더 */}
                <div style={{
                  background: p.bg,
                  borderBottom: `3px solid ${p.border}`,
                  padding: '22px 20px 18px',
                  textAlign: 'center',
                  position: 'relative',
                }}>
                  <button onClick={closeInfo} style={{
                    position: 'absolute', top: 10, right: 10,
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: p.color, padding: 4,
                  }}>
                    <X size={20} />
                  </button>

                  {/* 오늘의 정보 배지 */}
                  <div style={{
                    display: 'inline-block',
                    background: '#fff', color: p.color,
                    padding: '3px 10px', borderRadius: 99,
                    fontSize: (14 + fontScale), fontWeight: 700,
                    marginBottom: 10,
                    border: `1px solid ${p.border}`,
                  }}>
                    오늘의 정보 · {p.category}
                  </div>

                  <div style={{ fontSize: (46 + fontScale), marginBottom: 4 }}>{p.emoji}</div>
                  <h3 style={{
                    fontSize: (21 + fontScale), fontWeight: 800, margin: 0,
                    color: p.color, letterSpacing: '-0.02em',
                    lineHeight: 1.4,
                  }}>
                    {p.title}
                  </h3>
                </div>

                {/* 본문 */}
                <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>
                  <p style={{
                    fontSize: (18 + fontScale), color: '#1F2937', margin: 0, lineHeight: 1.7,
                    whiteSpace: 'pre-line',
                  }}>
                    {p.mainMessage}
                  </p>

                  {/* 상세 정보 */}
                  {p.detail && (
                    <div style={{
                      marginTop: 14, padding: '12px 14px',
                      background: p.bg + '60',
                      border: `1px solid ${p.border}`,
                      borderRadius: 10,
                    }}>
                      <p style={{
                        fontSize: (15 + fontScale), fontWeight: 700, color: p.color, margin: '0 0 4px',
                      }}>
                        📋 {p.detailLabel}
                      </p>
                      <p style={{
                        fontSize: (17 + fontScale), color: '#1F2937', margin: 0, lineHeight: 1.6,
                        whiteSpace: 'pre-line', fontWeight: 600,
                      }}>
                        {p.detail}
                      </p>
                    </div>
                  )}

                  {/* 팁 */}
                  {p.tip && (
                    <div style={{
                      marginTop: 12, padding: '10px 14px',
                      background: '#FFFBEB', border: '1px solid #FDE68A',
                      borderRadius: 10, display: 'flex', gap: 8,
                    }}>
                      <span style={{ fontSize: (18 + fontScale) }}>💡</span>
                      <p style={{ fontSize: (16 + fontScale), color: '#78350F', margin: 0, lineHeight: 1.6 }}>
                        {p.tip}
                      </p>
                    </div>
                  )}
                </div>

                {/* 하단 버튼 */}
                <div style={{
                  padding: '14px 18px',
                  borderTop: '1px solid #F3F4F6',
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                  <button onClick={closeInfo} style={{
                    width: '100%', padding: '14px',
                    background: p.color, color: '#fff', border: 'none',
                    borderRadius: 12, fontSize: (19 + fontScale), fontWeight: 700, cursor: 'pointer',
                  }}>
                    알겠어요
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ★ v12.1 글자 크기 선택 다이얼로그 */}
        {showFontSizeDialog && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, zIndex: 250,
          }}>
            <div style={{
              background: '#fff', borderRadius: 18,
              maxWidth: 340, width: '100%',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '20px 22px 14px',
                borderBottom: `1px solid ${colors.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <h3 style={{ fontSize: (18 + fontScale), fontWeight: 800, margin: 0 }}>
                  글자 크기
                </h3>
                <button onClick={() => setShowFontSizeDialog(false)} style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: colors.textSub, padding: 4,
                }}>
                  <X size={22} />
                </button>
              </div>

              <div style={{ padding: '18px 22px' }}>
                <p style={{ fontSize: (14 + fontScale), color: colors.textSub, margin: '0 0 16px', lineHeight: 1.5 }}>
                  보기 편한 크기를 선택하세요. 앱 전체 글씨가 바뀌어요.
                </p>

                <div style={{ display: 'flex', gap: 10 }}>
                  {[
                    { mode: 'small', label: '작게', sample: 16 },
                    { mode: 'normal', label: '보통', sample: 20 },
                    { mode: 'large', label: '크게', sample: 24 },
                  ].map(opt => {
                    const isActive = fontSizeMode === opt.mode;
                    return (
                      <button
                        key={opt.mode}
                        onClick={() => setFontSizeMode(opt.mode)}
                        style={{
                          flex: 1,
                          background: isActive ? colors.primary : '#fff',
                          color: isActive ? '#fff' : colors.text,
                          border: `2px solid ${isActive ? colors.primary : colors.border}`,
                          borderRadius: 14,
                          padding: '18px 8px',
                          cursor: 'pointer',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                        }}>
                        <span style={{ fontSize: opt.sample, fontWeight: 800, lineHeight: 1 }}>가</span>
                        <span style={{ fontSize: (14 + fontScale), fontWeight: 700 }}>{opt.label}</span>
                        {isActive && (
                          <span style={{ fontSize: (11 + fontScale), opacity: 0.9 }}>✓ 선택됨</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ padding: '4px 18px 18px' }}>
                <button onClick={() => setShowFontSizeDialog(false)} style={{
                  width: '100%', padding: '14px',
                  background: colors.primary, color: '#fff', border: 'none',
                  borderRadius: 12, fontSize: (15 + fontScale), fontWeight: 700, cursor: 'pointer',
                }}>
                  완료
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ★ v12.2 루틴 시간 편집 다이얼로그 */}
        {showRoutineTimeDialog && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16, zIndex: 250,
          }}>
            <div style={{
              background: '#fff', borderRadius: 18,
              maxWidth: 380, width: '100%',
              maxHeight: '90vh',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}>
              {/* 헤더 */}
              <div style={{
                padding: '20px 22px 14px',
                borderBottom: `1px solid ${colors.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: colors.primary + '15', color: colors.primary,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Bell size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: (17 + fontScale), fontWeight: 800, margin: 0 }}>
                      루틴 시간 설정
                    </h3>
                    <p style={{ fontSize: (12 + fontScale), color: colors.textSub, margin: '2px 0 0' }}>
                      내 생활에 맞게 시간을 바꿔보세요
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowRoutineTimeDialog(false)} style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: colors.textSub, padding: 4,
                }}>
                  <X size={22} />
                </button>
              </div>

              {/* 5개 루틴 시간 입력 */}
              <div style={{ padding: '16px 22px', overflowY: 'auto', flex: 1 }}>
                {todayActions.map((action, idx) => {
                  const Icon = action.icon;
                  return (
                    <div key={action.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 0',
                      borderBottom: idx < todayActions.length - 1 ? `1px solid ${colors.border}` : 'none',
                    }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: colors.primaryLight, color: colors.primary,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Icon size={20} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: (15 + fontScale), fontWeight: 700, margin: 0 }}>
                          {action.label}
                        </p>
                        <p style={{ fontSize: (12 + fontScale), color: colors.textSub, margin: '2px 0 0' }}>
                          {action.action.length > 20 ? action.action.slice(0, 20) + '…' : action.action}
                        </p>
                      </div>
                      <input
                        type="time"
                        value={action.time}
                        onChange={(e) => {
                          const newTime = e.target.value;
                          setTodayActions(prev => prev.map(a =>
                            a.id === action.id ? { ...a, time: newTime } : a
                          ));
                        }}
                        style={{
                          fontSize: (16 + fontScale), fontFamily: 'inherit',
                          padding: '8px 10px',
                          border: `2px solid ${colors.border}`, borderRadius: 10,
                          color: colors.text, background: '#fff',
                          cursor: 'pointer', outline: 'none',
                          flexShrink: 0,
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* 하단 버튼 */}
              <div style={{
                padding: '14px 18px',
                borderTop: `1px solid ${colors.border}`,
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <button onClick={() => {
                  setShowRoutineTimeDialog(false);
                  setTimeout(() => saveData(), 100);
                }} style={{
                  width: '100%', padding: '14px',
                  background: colors.primary, color: '#fff', border: 'none',
                  borderRadius: 12, fontSize: (15 + fontScale), fontWeight: 700, cursor: 'pointer',
                }}>
                  완료
                </button>
                <button onClick={() => {
                  // 기본 시간으로 되돌리기
                  const defaultTimes = { A00: '07:00', A01: '08:00', A02: '12:30', A03: '19:00', A04: '22:30' };
                  setTodayActions(prev => prev.map(a => ({ ...a, time: defaultTimes[a.id] || a.time })));
                }} style={{
                  width: '100%', padding: '10px',
                  background: 'transparent', color: colors.textSub,
                  border: 'none', fontSize: (13 + fontScale), fontWeight: 500, cursor: 'pointer',
                }}>
                  기본 시간으로 되돌리기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ★ v12.2 시간 선택 팝업 (시·분 + 확인 버튼) */}
        {showTimePicker && activeAction && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, zIndex: 260,
          }}>
            <div style={{
              background: '#fff', borderRadius: 20,
              maxWidth: 320, width: '100%',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
              overflow: 'hidden',
            }}>
              {/* 헤더 */}
              <div style={{
                padding: '18px 22px 14px',
                borderBottom: `1px solid ${colors.border}`,
                textAlign: 'center',
              }}>
                <h3 style={{ fontSize: (18 + fontScale), fontWeight: 800, margin: 0 }}>
                  {activeAction.label} 시간
                </h3>
                <p style={{ fontSize: (13 + fontScale), color: colors.textSub, margin: '4px 0 0' }}>
                  시간을 선택하세요
                </p>
              </div>

              {/* 시 : 분 선택 */}
              <div style={{
                padding: '24px 22px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              }}>
                {/* 시 */}
                <div style={{ textAlign: 'center' }}>
                  <button onClick={() => setPickerHour((pickerHour + 1) % 24)} style={{
                    width: 64, height: 40, border: `1px solid ${colors.border}`,
                    borderRadius: 10, background: '#fff', cursor: 'pointer',
                    fontSize: (18 + fontScale), color: colors.textSub,
                  }}>▲</button>
                  <div style={{
                    width: 64, padding: '12px 0', margin: '6px 0',
                    background: colors.primaryLight, borderRadius: 12,
                    fontSize: (32 + fontScale), fontWeight: 800, color: colors.primary,
                  }}>
                    {String(pickerHour).padStart(2, '0')}
                  </div>
                  <button onClick={() => setPickerHour((pickerHour + 23) % 24)} style={{
                    width: 64, height: 40, border: `1px solid ${colors.border}`,
                    borderRadius: 10, background: '#fff', cursor: 'pointer',
                    fontSize: (18 + fontScale), color: colors.textSub,
                  }}>▼</button>
                  <p style={{ fontSize: (12 + fontScale), color: colors.textSub, margin: '6px 0 0' }}>시</p>
                </div>

                <div style={{ fontSize: (32 + fontScale), fontWeight: 800, color: colors.text, paddingBottom: 24 }}>:</div>

                {/* 분 (5분 단위) */}
                <div style={{ textAlign: 'center' }}>
                  <button onClick={() => setPickerMinute((pickerMinute + 5) % 60)} style={{
                    width: 64, height: 40, border: `1px solid ${colors.border}`,
                    borderRadius: 10, background: '#fff', cursor: 'pointer',
                    fontSize: (18 + fontScale), color: colors.textSub,
                  }}>▲</button>
                  <div style={{
                    width: 64, padding: '12px 0', margin: '6px 0',
                    background: colors.primaryLight, borderRadius: 12,
                    fontSize: (32 + fontScale), fontWeight: 800, color: colors.primary,
                  }}>
                    {String(pickerMinute).padStart(2, '0')}
                  </div>
                  <button onClick={() => setPickerMinute((pickerMinute + 55) % 60)} style={{
                    width: 64, height: 40, border: `1px solid ${colors.border}`,
                    borderRadius: 10, background: '#fff', cursor: 'pointer',
                    fontSize: (18 + fontScale), color: colors.textSub,
                  }}>▼</button>
                  <p style={{ fontSize: (12 + fontScale), color: colors.textSub, margin: '6px 0 0' }}>분</p>
                </div>
              </div>

              {/* 버튼 */}
              <div style={{
                padding: '0 18px 18px',
                display: 'flex', gap: 8,
              }}>
                <button onClick={() => setShowTimePicker(false)} style={{
                  flex: 1, padding: '14px',
                  background: '#fff', color: colors.textSub,
                  border: `1px solid ${colors.border}`, borderRadius: 12,
                  fontSize: (15 + fontScale), fontWeight: 700, cursor: 'pointer',
                }}>
                  취소
                </button>
                <button onClick={() => {
                  const newTime = `${String(pickerHour).padStart(2, '0')}:${String(pickerMinute).padStart(2, '0')}`;
                  setActiveAction(prev => ({ ...prev, time: newTime }));
                  setTodayActions(prev => prev.map(a =>
                    a.id === activeAction.id ? { ...a, time: newTime } : a
                  ));
                  setShowTimePicker(false);
                  setTimeout(() => saveData(), 100);
                }} style={{
                  flex: 2, padding: '14px',
                  background: colors.primary, color: '#fff', border: 'none',
                  borderRadius: 12, fontSize: (15 + fontScale), fontWeight: 700, cursor: 'pointer',
                }}>
                  확인
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
