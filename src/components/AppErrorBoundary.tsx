import { Component, type ReactNode } from 'react';
import { BigButton, Screen, Title } from './ui';

// Render failures must not leave a blank screen. No health data, auth token or
// raw exception is sent to external error collectors or shown to the user.
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <Screen>
      <Title>화면을 다시 열어주세요</Title>
      <p role="alert">화면을 표시하는 중 문제가 생겼어요. 다시 열면 저장하지 않은 입력은 사라질 수 있어요. 저장 중이었다면 기록을 확인한 뒤 다시 시도해주세요.</p>
      <BigButton onClick={() => window.location.reload()}>앱 다시 열기</BigButton>
      <p>같은 문제가 반복되면 아래 설치 버전과 어떤 화면에서 발생했는지 알려주세요.</p>
      <p>설치 버전: {import.meta.env.VITE_BUILD_LABEL || '개발 환경'}</p>
    </Screen>;
  }
}
