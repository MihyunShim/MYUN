# DentureCare 개발 로드맵

> 개발 프로세스: 기획 → 설계 → 개발 → 테스트 → 소스관리 → 배포 → 출시 → 유지보수 (+수익화)
> 현재 위치: **프로토타입 v12 완성 → 정식 개발 전환 단계**

## 에이전트 구성 (.claude/agents/)

| 에이전트 | 단계 | 담당 |
|---|---|---|
| `planner` | 기획 | MVP 정의, 타겟 유저, 핵심 기능, 경쟁 분석, 차별화 |
| `architect` | 설계 | 화면 설계, 사용자 시나리오, 테이블/ERD, API 설계 |
| `frontend-dev` | 개발 | 웹/앱 화면, 로그인·회원가입 UI, 백엔드 연동, 알림 |
| `backend-dev` | 개발 | DB 구축(SQL/마이그레이션), API/CRUD, 인증, 예외 처리 |
| `qa-tester` | 테스트 | 테스트 시나리오, 기능 검증, 회귀 테스트 (코드 수정 안 함) |
| `devops` | 소스관리~출시 | Git/GitHub, 브랜치 전략, Vercel/Cloudflare 배포, 도메인/HTTPS, 스토어 등록 |
| `biz-strategy` | 수익화 | 광고/구독/유료서비스 모델, 가격 정책, 치과 B2B |

사용법: 대화에서 "planner 에이전트로 MVP 범위 다시 정리해줘"처럼 이름을 지정해 호출.

## Phase 0 — 기반 정리 ✅ 완료 (2026-07-13)
- [x] **git init + GitHub 저장소 생성** (github.com/MihyunShim/MYUN)
- [x] .gitignore 작성, 초기 커밋 (프로토타입 v12 포함)
- [x] 프로토타입 v12 기준 **MVP 기능 확정** — A1(사용자)+A2(가족)만, A3/A5는 2차

## Phase 1 — 설계 (1~2주)
- [x] 프로토타입 역설계: 화면 목록 + 이동 흐름 문서화 → docs/설계/01
- [x] 사용자 시나리오: 틀니 사용자/보호자 5종 → docs/설계/02
- [x] 데이터 모델: 테이블 7개 + ERD → docs/설계/03
- [x] API 명세 + 접근 권한(RLS) 규칙 → docs/설계/04
- [x] 기술 스택 확정: React+Vite+TS / Supabase / Vercel → docs/설계/00

## Phase 2 — 기초 개발 (진행 중)
- [x] 개발 환경 구축: Node.js LTS + React/Vite/TS + Supabase 연결 검증 (2026-07-13)
- [x] DB 테이블 생성 + 마이그레이션 (Supabase, 2026-07-13)
- [x] 핵심 데이터 연동: 루틴 저장/조회, 체크 기록 (리콜 일정 기록은 Phase 3)
- [x] 프로토타입 → 정식 프론트 전환 1차: 가입/로그인, 온보딩, A1 홈 (진행률/검진/응급/설정 화면은 Phase 3)
- [x] 프론트-백엔드 연동 + E2E 검증: 가입→온보딩→홈→체크→새로고침 유지 (2026-07-13)

## Phase 3 — 서비스 기능 (진행 중)
- [x] A1 전체 화면 완성: 진행률(연속일수·주간그래프), 치과 검진(D-day·기록), 설정(글자크기·알림시간·초대코드), 하단 탭바 (2026-07-13)
- [ ] 출시 전 체크: Supabase 'Confirm email' 다시 켜기 (개발 중 임시로 꺼둠, 2026-07-13)
- [ ] 회원가입 / 로그인 (`backend-dev` + `frontend-dev`)
- [ ] 소셜 로그인 (카카오 우선) 
- [x] 보호자 연동: 초대코드 연결 + 현황 조회 + 응급 알림 + 실시간 구독 (2026-07-13)
- [ ] 알림: Capacitor local-notifications (루틴/리콜)
- [ ] 각 기능 완료 시마다 `qa-tester` 검증

## Phase 4 — 배포 ✅ (2026-07-14)
- [x] 웹 Vercel 배포: https://myun-hazel.vercel.app (깃허브 push 시 자동 재배포)
- [ ] 브랜치 전략 적용: main(운영) / dev(개발)
- [x] 환경 변수 분리: 로컬 .env / Vercel 환경변수

## Phase 5 — 출시
- [ ] 도메인 연결 + HTTPS (`devops`)
- [ ] Capacitor 앱 빌드 (iOS/Android)
- [ ] 스토어 등록: 아이콘, 스크린샷, 설명문, 개인정보처리방침 (`devops`)
- [ ] 출시 전 전체 회귀 테스트 (`qa-tester`)

## Phase 6 — 유지보수 + 수익화
- [ ] 버그 수정 → dev → 테스트 → main → 재배포 루틴 정착
- [ ] 사용자 피드백 기반 기능 개선 (`planner` 판단)
- [ ] 수익 모델 검증: 보호자 구독 / 치과 B2B (`biz-strategy`)

## 지금 결정이 필요한 것
1. **백엔드 스택** — 1인 개발이면 Supabase(무료 티어, Auth 내장) 추천
2. **프론트 구조** — 단일 HTML 유지 vs React 등 빌드 도구 전환 (프로토타입이 JSX이므로 React 전환이 자연스러움)
3. **출시 우선순위** — 웹(PWA) 먼저 vs 앱스토어 동시
