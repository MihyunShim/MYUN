// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { EmailConfirmation } from '../../src/components/EmailConfirmation';
const mocks = vi.hoisted(() => ({ resend: vi.fn() }));
vi.mock('../../src/lib/db', () => ({ db: () => ({ auth: { resend: mocks.resend } }), friendlyError: () => '요청 제한' }));
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); mocks.resend.mockResolvedValue({ error: null }); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
it('메일을 재요청하며 중복 요청을 막고 수신 완료로 표현하지 않는다', async () => {
  render(<EmailConfirmation initialEmail="test@example.invalid" justRequested={false} onLogin={() => {}} />);
  const form = screen.getByLabelText('가입한 이메일').closest('form')!;
  await act(async () => { fireEvent.submit(form); fireEvent.submit(form); });
  expect(mocks.resend).toHaveBeenCalledExactlyOnceWith({ type: 'signup', email: 'test@example.invalid' });
  expect(screen.getByRole('status').textContent).toContain('실제 수신 여부는 메일함');
  expect((screen.getByRole('button', { name: /초 후/ }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => { vi.advanceTimersByTime(60_000); });
  expect((screen.getByText('인증 메일 다시 요청') as HTMLButtonElement).disabled).toBe(false);
});
it('실패 시 성공 문구 없이 주소와 로그인 복귀 경로를 유지한다', async () => {
  mocks.resend.mockResolvedValue({ error: new Error('429') }); const onLogin = vi.fn();
  render(<EmailConfirmation initialEmail="test@example.invalid" justRequested={false} onLogin={onLogin} />);
  await act(async () => { fireEvent.submit(screen.getByLabelText('가입한 이메일').closest('form')!); });
  expect(screen.getByRole('alert').textContent).toBe('요청 제한'); expect(screen.queryByRole('status')).toBeNull();
  fireEvent.click(screen.getByText('로그인 화면으로'));
  expect(onLogin).toHaveBeenCalledWith('test@example.invalid');
});
it('가입 직후에는 재전송을 기다리며 화면 종료 시 타이머를 제거한다', () => {
  const view = render(<EmailConfirmation initialEmail="test@example.invalid" justRequested onLogin={() => {}} />);
  fireEvent.submit(screen.getByLabelText('가입한 이메일').closest('form')!);
  expect(mocks.resend).not.toHaveBeenCalled();
  view.unmount(); expect(vi.getTimerCount()).toBe(0);
});
