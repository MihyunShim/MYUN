// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import HomeA2 from '../../src/screens/HomeA2';
const mocks = vi.hoisted(() => ({ profileRead: vi.fn(), signals: [] as AbortSignal[], remove: vi.fn(), refresh: vi.fn() }));
vi.mock('../../src/state/AuthContext', () => ({ useAuth: () => ({ elderId: 'elder', profile: { id: 'guardian', name: '보호자' }, refresh: mocks.refresh }) }));
vi.mock('../../src/components/SignOutButton', () => ({ SignOutButton: () => null }));
vi.mock('../../src/lib/db', () => ({ friendlyError: () => '조회 실패', db: () => ({
  from: (table: string) => {
    const query: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'order', 'limit', 'maybeSingle']) query[method] = () => query;
    query.abortSignal = (signal: AbortSignal) => { mocks.signals.push(signal); return query; };
    query.then = (resolve: (v: unknown) => void) => Promise.resolve({ data: table === 'care_links' ? { id: 'link' } : [], error: null }).then(resolve);
    return query;
  },
  rpc: () => ({ abortSignal: (signal: AbortSignal) => { mocks.signals.push(signal); return mocks.profileRead(); } }),
  channel: () => { const channel = { on: () => channel, subscribe: () => channel }; return channel; },
  removeChannel: mocks.remove,
}) }));
beforeEach(() => { vi.clearAllMocks(); mocks.signals = []; mocks.profileRead.mockResolvedValue({ data: { name: '공유받은 가족' }, error: null }); });
afterEach(cleanup);
it('재조회에서 공유 동의가 없으면 늦게 도착한 이전 응답으로 가족 정보를 복원하지 않는다', async () => {
  let finish!: (value: unknown) => void;
  mocks.profileRead.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<HomeA2 />);
  await act(async () => {});
  const oldSignal = mocks.signals[0];
  mocks.profileRead.mockResolvedValueOnce({ data: null, error: null });
  await act(async () => { window.dispatchEvent(new Event('online')); });
  expect(oldSignal.aborted).toBe(true);
  await screen.findByText(/가족의 개인정보 공유 동의를 기다리고 있어요/);
  await act(async () => { finish({ data: { name: '뒤늦은 개인정보' }, error: null }); });
  expect(screen.queryByText(/뒤늦은 개인정보/)).toBeNull();
  expect(screen.getByText(/가족의 개인정보 공유 동의를 기다리고 있어요/)).toBeTruthy();
});
it('화면 종료 시 요청·실시간 채널을 정리한다', async () => {
  const view = render(<HomeA2 />);
  await screen.findByText('공유받은 가족님의 오늘');
  expect(screen.getByText(/마지막 확인:/)).toBeTruthy();
  view.unmount(); expect(mocks.signals.every(signal => signal.aborted)).toBe(true);
  expect(mocks.remove).toHaveBeenCalledTimes(1);
});
