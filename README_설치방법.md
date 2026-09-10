# 틀니케어 — Xcode로 내 아이폰에 설치하기

이 문서는 현재 React 앱(`src/`) 기준입니다. Xcode 프로젝트는 이미 `ios/App/App.xcodeproj`에 있습니다. `app/`과 `DentureCare.html`은 이전 프로토타입입니다.

목표는 **본인 아이폰에 개발용으로 설치해 검수하기**입니다. App Store 제출 준비는 [출시 점검표](RELEASE_CHECKLIST.md)에서 확인하세요.

## 1. Mac 준비

- Xcode를 설치하고 한 번 실행해 추가 구성 요소 설치를 마칩니다. 연결할 아이폰의 iOS를 지원하는 버전을 사용하세요.
- Xcode → Settings → Apple Accounts에서 본인 Apple 계정으로 로그인합니다.
- Xcode → Settings → Locations → Command Line Tools에 설치한 Xcode를 선택합니다.
- Node.js 22 이상, USB 연결 케이블, 인터넷 연결을 준비합니다.

무료 Personal Team으로도 본인 기기에 설치할 수 있습니다. 이 경우 프로비저닝이 7일 후 만료되면 Xcode에서 다시 빌드·설치해야 합니다. App Store/TestFlight 배포에는 Apple Developer Program 가입이 필요합니다. [Apple 계정 안내](https://developer.apple.com/help/account/basics/about-your-developer-account/)

## 2. 검수할 코드 받기

기존 작업 폴더와 별도로 받는 예시입니다. 터미널에서 실행하세요.

```bash
git clone --branch codex/ios-device-readiness https://github.com/MihyunShim/MYUN.git MYUN-ios
cd MYUN-ios
npm ci
```

이미 이 브랜치를 받은 폴더가 있으면 해당 폴더를 사용하면 됩니다. 기존 수정 파일을 삭제하거나 덮어쓸 필요는 없습니다.

## 3. Supabase 연결 설정

`.env`가 없을 때만 예제를 복사합니다.

```bash
test -f .env || cp .env.example .env
```

`.env`를 편집해 기존 프로젝트의 공개 URL과 공개 키를 입력합니다.

| 설정 | 값 |
|---|---|
| `VITE_SUPABASE_URL` | Supabase 프로젝트 HTTPS URL |
| `VITE_SUPABASE_ANON_KEY` | 공개 `anon` JWT 또는 `sb_publishable_…` 키 |
| `VITE_PRIVACY_POLICY_URL` | 출시 전에 준비할 실제 개인정보처리방침 HTTPS 페이지 |
| `VITE_SUPPORT_EMAIL` | 출시 전에 확정할 운영 문의 이메일 |

Supabase 대시보드의 Project Settings → API에서 확인합니다. `service_role` / `sb_secret_…` 키는 앱에 포함하면 안 됩니다. 키를 대화나 공개 저장소에 붙여넣지 마세요. `.env`는 Git에서 제외되어 있습니다.

계정·기록은 **Supabase 서버에 저장**됩니다. 로그인·기록 저장·가족 조회에는 인터넷이 필요합니다. 오프라인 저장 후 자동 전송 기능은 아직 없습니다. 연결 설정이 없으면 로그인 대신 앱 준비 안내 화면이 나옵니다.

## 4. 데이터베이스 변경 준비

기존 프로젝트라면 이미 적용한 `001`을 다시 실행하지 마세요. Supabase SQL Editor에서 현재 적용 상태를 확인한 뒤 누락된 변경만 순서대로 적용합니다.

| SQL 파일 | 용도 |
|---|---|
| `001_init.sql` | 신규 프로젝트의 테이블·인증 프로필·RLS·Realtime |
| `002_missed_alerts.sql` | 미수행 알림 서버 작업. Supabase에서 `pg_cron` 설정 필요 |
| `003_undo_check.sql` | 본인의 완료 기록 취소 허용 |
| `004_account_safety.sql` | 연결 해제·초대코드 교체·본인 탈퇴·수정 가능 열 제한 |

이번 변경에서는 운영 DB에 SQL을 실행하지 않았습니다. **별도 테스트 Supabase 프로젝트에서 `004`를 먼저 검증하고**, 운영 적용 전 백업과 적용 시간을 정하세요. `004`가 없으면 계정 관리 화면에 기능 준비 안내가 표시됩니다. 기존 사용자 기록을 자동 삭제하는 마이그레이션은 아닙니다. 탈퇴 삭제는 로그인한 사용자가 앱에서 확인한 때만 실행됩니다.

이메일 확인이 켜져 있으면 가입 메일의 확인 링크를 누른 후 앱으로 돌아와 이메일로 로그인하세요. Supabase의 Site URL과 Redirect URLs에는 본인이 운영하는 정상 웹 주소를 설정합니다. 이번 iOS 검수는 이메일 로그인으로 진행합니다. 네이티브 카카오 로그인은 복귀 처리 준비 전이라 버튼을 표시하지 않습니다.

## 5. Xcode 열기

프로젝트 최상위 폴더에서 실행합니다.

```bash
npm run ios:run
```

Mac/Xcode/공개 연결 설정 확인 → TypeScript 검사 → `dist` 빌드 → `cap sync ios` → Xcode 열기가 차례로 실행됩니다. 기존 iOS 프로젝트가 있으므로 `cap add ios`는 실행하지 않습니다.

수정한 코드나 변경한 `.env`를 기기에 반영할 때도 같은 명령을 실행하고 Xcode에서 Run을 누릅니다.

## 6. 아이폰 연결·서명·실행

1. 아이폰을 케이블로 Mac에 연결하고 잠금을 해제합니다. 요청되면 양쪽에서 기기/컴퓨터를 신뢰합니다.
2. Xcode 왼쪽 파란 App 프로젝트 → TARGETS의 App → Signing & Capabilities를 엽니다.
3. Automatically manage signing을 켜고 Team을 본인의 팀으로 선택합니다. 저장소에는 기존 팀 값이 있으므로 본인 계정과 일치하는지 확인하세요.
4. Bundle Identifier 기본값은 `com.denturecare.app`입니다. 소유권 오류가 나면 본인이 소유한 고유 ID를 정하고 `capacitor.config.json`의 `appId`와 Xcode 값을 함께 맞춥니다. 다른 앱 ID로 설치하면 별도 앱으로 취급됩니다.
5. Xcode 상단 실행 대상에서 **실제 연결한 아이폰**을 고릅니다. `Any iOS Device`는 설치 대상 선택이 아닙니다.
6. 아이폰에서 요청되면 설정 → 개인정보 보호 및 보안 → 개발자 모드를 켜고 재시작합니다.
7. Xcode ▶ Run 또는 `⌘R`을 누릅니다. 아이폰에서 개발자 신뢰 확인이 요청되면 안내에 따라 허용합니다.

Swift 패키지는 `ios/App/CapApp-SPM`과 `node_modules`를 함께 사용합니다. 최초 실행 때 패키지 다운로드가 끝날 때까지 기다리세요. 폴더 이동/누락 오류는 프로젝트 최상위에서 `npm ci`와 `npm run ios:prepare`를 다시 실행해 확인합니다. CocoaPods 설치는 이 프로젝트의 기본 경로에 필요하지 않습니다.

공식 안내: [Xcode 기기 실행](https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices), [Capacitor 6 iOS](https://capacitorjs.com/docs/v6/ios).

## 7. 미현님 최종 검수

실제 환자 정보 대신 시험 계정 두 개(사용자/보호자)로 확인하세요.

- [ ] 가입 → 이메일 확인 → 로그인 → 틀니 정보/시간 입력 → 홈 진입
- [ ] 관리 완료/취소 후 앱을 완전히 닫았다 열어도 오늘 기록 유지
- [ ] 네트워크를 끊고 저장하면 오류 안내, 연결 복구 후 재시도 가능
- [ ] 설정에서 알림 허용 → **10초 후 시험 알림** → 홈 화면/잠금 화면에서 수신
- [ ] 관리 시간을 가까운 시각으로 변경 → 예약 알림 수신, 다음 날 반복도 확인
- [ ] 로그아웃 뒤 이전 계정의 관리 알림이 오지 않는지 확인
- [ ] 초대코드로 가족 연결 → 양쪽 관리 현황 확인 → 해제 후 접근 차단과 코드 변경 확인
- [ ] 도움 요청을 보호자 앱을 열어 확인. 앱이 닫힌 보호자에게는 푸시가 오지 않는다는 안내 확인
- [ ] 설정의 큰 글자, 키보드 표시, 화면 회전, 홈 표시줄과 하단 탭 겹침 확인
- [ ] 시험 계정의 회원 탈퇴 → 본인 기록 삭제, 상대 가족 계정 유지 확인
- [ ] 검진 주기, 세정/보관 방법, 건강보험 정보의 내용·근거·표현 최종 검수

문제가 생기면 **화면 캡처 + 직전에 누른 버튼 + 아이폰/iOS 버전**을 이 대화에 남겨주세요. Xcode 오류는 빨간 오류 문구를 함께 보내면 됩니다.
