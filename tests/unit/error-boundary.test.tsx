// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AppErrorBoundary } from '../../src/components/AppErrorBoundary';
afterEach(cleanup);
it('화면 오류 시 민감한 예외 내용 대신 복구 안내와 설치 버전을 표시한다', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  function Broken(): never { throw new Error('secret token and health record'); }
  render(<AppErrorBoundary><Broken /></AppErrorBoundary>);
  expect(screen.getByRole('heading', { name: '화면을 다시 열어주세요' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '앱 다시 열기' })).toBeTruthy();
  expect(screen.getByRole('alert').textContent).toContain('저장하지 않은 입력');
  expect(screen.queryByText(/secret token/)).toBeNull();
});
