# Xcode 메모리 초과 종료 확인

사진의 “The process has been terminated … using too much memory / code 9”는 디버깅 중인 프로세스가 메모리 사용 문제로 종료됐다는 알림입니다. 원인 함수, 실제 기기/시뮬레이터 여부, 앱 메모리 사용량은 이 알림만으로 확정할 수 없습니다. 빌드 성공도 실행 중 메모리 안정성을 보장하지 않습니다. 이번 변경으로 이 오류가 해결됐다고 검증하지 않았습니다.

1. Xcode에서 정지(■) 후 iPhone 홈 화면에서 앱을 직접 실행합니다. 어느 화면·버튼에서 종료되는지 기록합니다. 앱을 삭제하거나 데이터를 지우지 않습니다.
2. 직접 실행해도 종료되면 iPhone을 재시동하고 같은 순서로 한 번 확인합니다. 음성 생성/미리듣기 직후였다면 기본 알림음 상태와 비교합니다. 반복 음성 생성은 피합니다.
3. 다시 Xcode에 연결하여 실행하고 왼쪽 Debug Navigator의 Memory 그래프를 봅니다. 화면 전환 또는 특정 버튼마다 메모리가 계속 증가하는지 확인합니다.
4. 재현된다면 Product → Profile에서 Allocations 또는 Leaks로 기록합니다. 이는 개발자용 메모리 분석 도구입니다. 발견된 객체 증가와 호출 경로를 보고 수정해야 하며, 단순 캐시 삭제는 원인 해결을 보장하지 않습니다.
5. 오류창 Show Details와 종료 직전 동작, 실행 대상(iPhone/Simulator), 메모리 그래프를 함께 보관합니다. iPhone 설정 → 개인정보 보호 및 보안 → 분석 및 향상 → 분석 데이터에서 같은 시각의 JetsamEvent 기록이 있으면 확인합니다. 공유 전 개인 식별 정보는 가립니다.

시뮬레이터에서만 발생했다면 Mac의 활성 상태 보기에서 메모리 압박도 확인합니다. iPhone에서 발생한 종료를 Mac 메모리 부족으로 단정하지 않습니다.

Apple 공식 설명: https://developer.apple.com/documentation/xcode/identifying-high-memory-use-with-jetsam-event-reports
