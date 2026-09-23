// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GuardianRequests } from '../../src/components/GuardianRequests';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), refresh: vi.fn() }));
vi.mock('../../src/lib/db', () => ({ db: () => ({ rpc: mocks.rpc }), friendlyError: () => '연결 실패' }));
vi.mock('../../src/state/AuthContext', () => ({ useAuth: () => ({ refresh: mocks.refresh }) }));
vi.mock('../../src/lib/useRefreshOnResume', () => ({ useRefreshOnResume: () => {} }));
const request = { id: 'r', other_name: '가족', relation: '어머니', status: 'pending', expires_at: '2099-01-01T00:00:00Z' };
beforeEach(() => vi.resetAllMocks());
afterEach(() => { cleanup(); vi.useRealTimers(); });
it('조회 중 또는 실패를 빈 요청으로 표시하지 않는다', async () => {
  let finish!: (result: unknown) => void;
  mocks.rpc.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  render(<GuardianRequests />);
  expect(screen.getByText('연결 요청을 확인하고 있어요...')).toBeTruthy();
  expect(screen.queryByText('연결 요청이 없어요.')).toBeNull();
  await act(async () => finish({ error: new Error('offline') }));
  expect(screen.getByRole('alert').textContent).toBe('연결 실패');
  expect(screen.queryByText('연결 요청이 없어요.')).toBeNull();
});
it('새 조회보다 늦게 도착한 이전 결과는 대기 상태를 되살리지 않는다', async () => {
  let old!: (result: unknown) => void;
  mocks.rpc.mockReturnValueOnce(new Promise(resolve => { old = resolve; })).mockResolvedValueOnce({ data: [{ ...request, status: 'rejected' }] });
  const view = render(<GuardianRequests reloadKey={0} />);
  view.rerender(<GuardianRequests reloadKey={1} />);
  await screen.findByText(/사용자가 요청을 거절했어요/);
  await act(async () => old({ data: [request] }));
  expect(screen.queryByText(/사용자 승인 대기 중/)).toBeNull();
});
it('만료 시각을 넘기면 화면의 승인 버튼을 숨긴다', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-23T00:00:00Z'));
  mocks.rpc.mockResolvedValue({ data: [{ ...request, expires_at: '2026-09-23T00:00:01Z' }] });
  render(<GuardianRequests elder />);
  await act(async () => {});
  expect(screen.getByText('아는 가족이에요 · 연결 승인')).toBeTruthy();
  await act(async () => { vi.advanceTimersByTime(1100); });
  expect(screen.queryByText('아는 가족이에요 · 연결 승인')).toBeNull();
  expect(screen.getByText(/24시간이 지나 요청이 만료됐어요/)).toBeTruthy();
});
