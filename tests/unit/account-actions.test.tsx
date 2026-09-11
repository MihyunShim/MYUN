// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AccountActions } from '../../src/components/AccountActions';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), signOut: vi.fn(), refresh: vi.fn() }));
vi.mock('../../src/lib/db', () => ({ db: () => ({ rpc: mocks.rpc }), friendlyError: () => '연결 실패' }));
vi.mock('../../src/state/AuthContext', () => ({ useAuth: () => ({ signOut: mocks.signOut, refresh: mocks.refresh }) }));
beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ data: [], error: null }); mocks.signOut.mockResolvedValue(undefined); });
afterEach(cleanup);
it('가족 목록 실패를 연결 없음으로 표시하지 않고 재시도로 복구한다', async () => {
  mocks.rpc.mockResolvedValueOnce({ error: new Error('offline') });
  render(<AccountActions />);
  await screen.findByText('연결 실패');
  expect(screen.queryByText('연결된 가족이 없어요.')).toBeNull();
  fireEvent.click(screen.getByText('가족 연결 다시 확인'));
  await screen.findByText('연결된 가족이 없어요.');
  expect(screen.queryByText('연결 실패')).toBeNull();
});
it('삭제 완료 후 로그인 종료를 재시도해도 계정을 다시 삭제하지 않는다', async () => {
  mocks.signOut.mockRejectedValueOnce(new Error('offline'));
  render(<AccountActions />);
  await screen.findByText('연결된 가족이 없어요.');
  fireEvent.click(screen.getByText('회원 탈퇴'));
  fireEvent.change(screen.getByLabelText('확인하려면 ‘탈퇴’를 입력해주세요'), { target: { value: '탈퇴' } });
  fireEvent.click(screen.getByText('계정과 기록 영구 삭제'));
  await screen.findByText('로그인 종료 다시 시도');
  fireEvent.click(screen.getByText('로그인 종료 다시 시도'));
  await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(2));
  expect(mocks.rpc.mock.calls.filter(([name]) => name === 'delete_own_account')).toHaveLength(1);
});
it('삭제 실패 시 확인 입력을 유지하고 삭제를 다시 시도할 수 있다', async () => {
  render(<AccountActions />); await screen.findByText('연결된 가족이 없어요.');
  mocks.rpc.mockResolvedValueOnce({ error: new Error('offline') });
  fireEvent.click(screen.getByText('회원 탈퇴'));
  fireEvent.change(screen.getByLabelText('확인하려면 ‘탈퇴’를 입력해주세요'), { target: { value: '탈퇴' } });
  fireEvent.click(screen.getByText('계정과 기록 영구 삭제'));
  await screen.findByText('연결 실패');
  expect(mocks.signOut).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('계정과 기록 영구 삭제'));
  await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(1));
});
