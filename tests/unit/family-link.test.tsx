// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import OnboardingA2 from '../../src/screens/OnboardingA2';
import { FamilyInviteCard } from '../../src/components/FamilyInviteCard';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), refresh: vi.fn(), copy: vi.fn() }));
vi.mock('../../src/lib/db', () => ({ db: () => ({ rpc: mocks.rpc }), friendlyError: () => '최신 코드를 확인해주세요' }));
vi.mock('../../src/state/AuthContext', () => ({ useAuth: () => ({ profile: { invite_code: 'ABC123' }, refresh: mocks.refresh, signOut: vi.fn() }) }));
vi.mock('../../src/components/GuardianRequests', async () => {
  const { useEffect } = await import('react');
  return { GuardianRequests: ({ onPendingChange, reloadKey }: { onPendingChange: (pending: boolean) => void; reloadKey: number }) => {
    useEffect(() => { onPendingChange(reloadKey > 0); }, [onPendingChange, reloadKey]);
    return <p>승인 대기 목록</p>;
  } };
});
vi.mock('../../src/screens/AccountScreen', () => ({ default: () => null }));
beforeEach(() => { vi.resetAllMocks(); Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: mocks.copy } }); });
afterEach(cleanup);
it('정규화한 코드로 한 번만 연결하고 완료 확인 후 현황을 연다', async () => {
  let finish!: (value: unknown) => void;
  mocks.rpc.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  render(<OnboardingA2 />);
  fireEvent.change(screen.getByLabelText('초대코드 (6자리)'), { target: { value: 'ab c123' } });
  const form = screen.getByText('연결 요청하기').closest('form')!;
  fireEvent.submit(form); fireEvent.submit(form);
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
  expect(mocks.rpc).toHaveBeenCalledWith('request_guardian_connection', { code: 'ABC123', rel: '어머니' });
  await act(async () => finish({ error: null }));
  expect(mocks.refresh).not.toHaveBeenCalled();
  expect(screen.getByText('연결 요청을 보냈어요')).toBeTruthy();
});
it('잘못된 코드 실패 후 입력을 유지하고 다시 연결한다', async () => {
  mocks.rpc.mockResolvedValueOnce({ error: new Error('INVALID_CODE') }).mockResolvedValueOnce({ error: null });
  render(<OnboardingA2 />);
  fireEvent.change(screen.getByLabelText('초대코드 (6자리)'), { target: { value: 'ABC123' } });
  fireEvent.click(screen.getByText('연결 요청하기'));
  await screen.findByText('최신 코드를 확인해주세요');
  expect((screen.getByLabelText('초대코드 (6자리)') as HTMLInputElement).value).toBe('ABC123');
  fireEvent.click(screen.getByText('연결 요청하기'));
  await screen.findByText('연결 요청을 보냈어요');
});
it('표시된 초대코드를 복사하고 수동 전달을 안내한다', async () => {
  mocks.copy.mockResolvedValue(undefined);
  render(<FamilyInviteCard />); fireEvent.click(screen.getByText('초대코드 복사'));
  await screen.findByText('초대코드를 복사했어요. 보호자에게 직접 전달해주세요.');
  expect(mocks.copy).toHaveBeenCalledWith('ABC123');
});
it('클립보드 접근 실패 시 직접 복사 방법을 안내한다', async () => {
  mocks.copy.mockRejectedValue(new Error('denied'));
  render(<FamilyInviteCard />); fireEvent.click(screen.getByText('초대코드 복사'));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('길게 눌러'));
});
