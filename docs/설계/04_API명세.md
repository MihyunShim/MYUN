# 04. API 명세 (데이터 작업 + 접근 권한)

> Supabase는 별도 API 서버 없이 앱에서 DB로 직접 요청한다.
> 대신 **RLS(Row Level Security, 행 단위 접근 규칙)**가 서버 역할의 보안을 담당한다.
> "누가 어떤 데이터를 읽고 쓸 수 있는가"가 이 문서의 핵심.

## 1. 인증 (Supabase Auth)

| 작업 | 방법 | 비고 |
|---|---|---|
| 회원가입 | 이메일+비밀번호 (1차) | 고령자는 가족이 함께 설정하는 시나리오 전제 |
| 로그인 | 이메일+비밀번호 | 자동 로그인 유지 (세션 영속) |
| 소셜 로그인 | 카카오 (2차 확장) | MVP 이후. Supabase OAuth 프로바이더 사용 |
| 가입 직후 | `profiles` 행 생성 (role 선택) | DB 트리거로 자동 생성 |

## 2. 데이터 작업 명세

### A1 (틀니 사용자) 흐름

| 기능 | 작업 | 대상 테이블 |
|---|---|---|
| 온보딩 저장 | INSERT | profiles(UPDATE), dentures, routines(5행) |
| 오늘 할 일 조회 | SELECT routines + 오늘 routine_logs | routines, routine_logs |
| 루틴 완료 체크 | INSERT (유니크: user·slot·날짜) | routine_logs |
| 진행률 조회 | SELECT 최근 90일 로그 → streak 계산 | routine_logs |
| 검진 기록 | INSERT + next_recall_on 계산값 저장 | checkups |
| 응급 신고 | INSERT (type=emergency) | alerts |
| 알림 시간 수정 | UPDATE | routines |

### A2 (가족 보호자) 흐름

| 기능 | 작업 | 대상 테이블 |
|---|---|---|
| 초대코드 연결 | SELECT profiles(코드 일치 확인) → INSERT | care_links |
| 부모님 현황 조회 | SELECT (연결된 elder의) 오늘 로그 | routine_logs, profiles |
| 주간 리포트 | SELECT 최근 7일 로그 + checkups | routine_logs, checkups |
| 알림 목록/읽음 | SELECT / UPDATE read_at | alerts |
| 응급 실시간 수신 | Realtime 구독 (alerts INSERT 이벤트) | alerts |
| 연결 해제 | UPDATE status=revoked | care_links |

## 3. 접근 권한 규칙 (RLS) — 보안의 핵심

| 테이블 | 본인(A1) | 연결된 보호자(A2) | 그 외 |
|---|---|---|---|
| profiles | 읽기/수정 (자기 행) | 읽기 (연결된 elder만) | ❌ |
| dentures | 읽기/쓰기 | 읽기 | ❌ |
| routines | 읽기/쓰기 | 읽기 | ❌ |
| routine_logs | 읽기/쓰기 | 읽기 (+대리 체크 INSERT는 2차 검토) | ❌ |
| checkups | 읽기/쓰기 | 읽기 | ❌ |
| care_links | 읽기/해제 | 읽기/생성/해제 (자기 행) | ❌ |
| alerts | 생성/읽기 | 읽기/읽음 처리 | ❌ |

"연결된 보호자" 판정: `care_links`에 (elder_id, guardian_id, status='active') 행이 존재할 때만.

예외 규칙:
- 초대코드 조회만은 미연결 상태에서 허용 (코드→elder_id 확인용, 코드 전체 노출은 금지하고 일치 확인만)
- 보호자는 어떤 경우에도 어르신 데이터를 수정할 수 없음 (읽기 전용 원칙, 대리 체크는 2차 검토)

## 4. 에러 처리 공통 규칙

- 네트워크 실패: "인터넷 연결을 확인해주세요" + 재시도 버튼 (고령자용 쉬운 문구)
- 루틴 중복 체크: 무시하고 완료 상태 유지 (에러 노출 안 함)
- 초대코드 불일치: "코드를 다시 확인해주세요. 부모님 앱의 설정에서 볼 수 있어요"
- 오프라인 루틴 체크: 로컬 큐에 저장 → 재연결 시 동기화 (2차, MVP는 온라인 전제)
