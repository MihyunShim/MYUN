// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SignOutButton } from '../../src/components/SignOutButton';
const mocks = vi.hoisted(() => ({ anonymous: true, signOut: vi.fn() }));
vi.mock('../../src/state/AuthContext', () => ({ useAuth: () => ({ session: { user: { is_anonymous: mocks.anonymous } }, signOut: mocks.signOut }) }));
vi.mock('../../src/lib/db', () => ({ friendlyError: () => '연결 실패' }));
beforeEach(() => { vi.clearAllMocks(); mocks.anonymous = true; mocks.signOut.mockResolvedValue(undefined); });
afterEach(cleanup);
it('홈의 임시 보호자 로그아웃도 확인하며 취소 시 연결을 유지한다', () => {
  render(<SignOutButton compact />);
  fireEvent.click(screen.getByText('로그아웃'));
  expect(screen.getByRole('dialog', { name: '로그아웃할까요?' })).toBeTruthy();
  expect(mocks.signOut).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('계속 이용하기'));
  expect(screen.queryByRole('dialog')).toBeNull(); expect(mocks.signOut).not.toHaveBeenCalled();
});
it('확인 후 한 번만 로그아웃하고 진행 중에는 닫지 않는다', async () => {
  let finish!: () => void;
  mocks.signOut.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  render(<SignOutButton />); fireEvent.click(screen.getByText('로그아웃'));
  const confirm = screen.getByText('알겠어요, 로그아웃');
  fireEvent.click(confirm); fireEvent.click(confirm);
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(screen.getByRole('dialog')).toBeTruthy(); expect(mocks.signOut).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  expect(screen.queryByRole('dialog')).toBeNull();
});
it('이메일 계정은 바로 로그아웃하고 실패를 표시한다', async () => {
  mocks.anonymous = false; mocks.signOut.mockRejectedValue(new Error('offline'));
  render(<SignOutButton />); fireEvent.click(screen.getByText('로그아웃'));
  await screen.findByText('연결 실패'); expect(screen.queryByRole('dialog')).toBeNull();
  await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(1));
});
