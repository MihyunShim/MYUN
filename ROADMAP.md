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

## Phase 0 — 기반 정리 (지금 바로) 🔴
- [ ] **git init + GitHub 저장소 생성** (`devops`) — 지금 버전 관리가 전혀 없어서 가장 위험
- [ ] .gitignore 작성, 초기 커밋 (프로토타입 v12 포함)
- [ ] 프로토타입 v12 기준 **MVP 기능 확정** (`planner`) — 정식 개발에 가져갈 것 / 버릴 것 구분

## Phase 1 — 설계 (1~2주)
- [ ] 프로토타입 역설계: 화면 목록 + 이동 흐름 문서화 (`architect`)
- [ ] 사용자 시나리오 2종: 틀니 사용자 / 보호자 (`architect`)
- [ ] 데이터 모델: 테이블 정의서 + ERD (`architect`)
- [ ] API 명세 작성 (`architect`)
- [ ] 백엔드 스택 확정: Supabase vs Firebase vs 자체 서버 (`architect` + `backend-dev`)

## Phase 2 — 기초 개발 (2~4주)
- [ ] DB 테이블 생성 + 마이그레이션 (`backend-dev`)
- [ ] 핵심 API: 루틴 CRUD, 체크 기록, 리콜 일정 (`backend-dev`)
- [ ] 프로토타입 → 정식 프론트 코드 전환 (`frontend-dev`)
- [ ] 프론트-백엔드 연동 (`frontend-dev`)

## Phase 3 — 서비스 기능 (2~3주)
- [ ] 회원가입 / 로그인 (`backend-dev` + `frontend-dev`)
- [ ] 소셜 로그인 (카카오 우선) 
- [ ] 보호자 연동 기능 (계정 연결 + 조회 권한)
- [ ] 알림: Capacitor local-notifications (루틴/리콜)
- [ ] 각 기능 완료 시마다 `qa-tester` 검증

## Phase 4 — 배포 (1주)
- [ ] 웹(PWA) Vercel/Cloudflare Pages 배포 (`devops`)
- [ ] 브랜치 전략 적용: main(운영) / dev(개발)
- [ ] 개발/운영 환경 변수 분리

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
