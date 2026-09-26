// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { AuthProvider, useAuth } from '../../src/state/AuthContext';

const mock = vi.hoisted(() => ({ callback: null as null | ((event: string, session: Session | null) => unknown),
  query: vi.fn(), signOut: vi.fn(), cancel: vi.fn(), owner: vi.fn(), unsubscribe: vi.fn() }));
vi.mock('../../src/lib/kakao', () => ({ applyPendingRole: vi.fn() }));
vi.mock('../../src/lib/notifications', () => ({ cancelRoutineNotifications: mock.cancel, setNotificationOwner: mock.owner }));
vi.mock('../../src/lib/db', () => ({ friendlyError: () => '연결 실패', db: () => ({
  rpc: async () => ({ data: { personal:true, sensitive:true }, error:null }),
  auth: { onAuthStateChange: (callback: typeof mock.callback) => { mock.callback = callback; return { data: { subscription: { unsubscribe: mock.unsubscribe } } }; }, signOut: mock.signOut },
  from: (table: string) => {
    let userId: string;
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'order', 'limit']) builder[method] = () => builder;
    builder.eq = (column: string, value: string) => { if (['id', 'user_id', 'guardian_id'].includes(column)) userId = value; return builder; };
    builder.single = builder.maybeSingle = () => mock.query(table, userId);
    builder.then = (resolve: (v: unknown) => unknown, reject: (v: unknown) => unknown) => Promise.resolve(mock.query(table, userId)).then(resolve, reject);
    return builder;
  },
}) }));
function Probe() {
  const auth = useAuth();
  return <><p>{auth.loading ? 'loading' : auth.error || auth.profile?.id || 'guest'}</p>
    <button onClick={auth.refresh}>retry</button><button onClick={auth.signOut}>logout</button></>;
}
const session = (id: string) => ({ user: { id, app_metadata: { provider: 'email' } }, access_token: 'test' } as Session);
const good = (table: string, id: string) => table === 'profiles' ? { data: { id, role: 'A1' }, error: null } : { data: null, error: null, count: 5 };
const emit = (id: string | null) => act(() => { mock.callback?.('SIGNED_IN', id ? session(id) : null); });
beforeEach(() => {
  vi.clearAllMocks(); mock.query.mockImplementation(good); mock.cancel.mockResolvedValue(undefined);
  mock.signOut.mockImplementation(async () => { mock.callback?.('SIGNED_OUT', null); return { error: null }; });
});
afterEach(cleanup);
it('인증 콜백은 Promise를 반환하지 않고 프로필 요청은 콜백 밖에서 한다', async () => {
  render(<AuthProvider><Probe /></AuthProvider>);
  act(() => {
    expect(mock.callback?.('SIGNED_IN', session('first'))).toBeUndefined();
    expect(mock.query).not.toHaveBeenCalled();
  });
  await screen.findByText('first');
  expect(mock.owner).toHaveBeenLastCalledWith('first');
});
it('프로필 실패 후 무한 로딩 대신 재시도로 복구한다', async () => {
  mock.query.mockResolvedValueOnce({ error: new Error('offline') });
  render(<AuthProvider><Probe /></AuthProvider>); emit('first');
  await screen.findByText('연결 실패');
  fireEvent.click(screen.getByText('retry'));
  await screen.findByText('first');
});
it('설정을 새로 읽는 동안 현재 화면을 로딩 화면으로 교체하지 않는다', async () => {
  render(<AuthProvider><Probe /></AuthProvider>); emit('first'); await screen.findByText('first');
  let finish!: (value: unknown) => void;
  mock.query.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  fireEvent.click(screen.getByText('retry'));
  await waitFor(() => expect(finish).toBeTypeOf('function'));
  expect(screen.getByText('first')).toBeTruthy();
  expect(screen.queryByText('loading')).toBeNull();
  await act(async () => { finish(good('profiles', 'first')); });
});
it('이전 계정의 늦은 응답은 새 계정 화면을 덮지 않는다', async () => {
  let finish!: (data: unknown) => void;
  mock.query.mockImplementation((table, id) => table === 'profiles' && id === 'first'
    ? new Promise((resolve) => { finish = resolve; }) : good(table, id));
  render(<AuthProvider><Probe /></AuthProvider>); emit('first');
  await waitFor(() => expect(finish).toBeTypeOf('function'));
  emit('second'); await screen.findByText('second');
  await act(async () => { finish(good('profiles', 'first')); });
  expect(screen.queryByText('first')).toBeNull();
  expect(screen.getByText('second')).toBeTruthy();
  expect(mock.owner).toHaveBeenLastCalledWith('second');
});
it('알림 정리에 실패해도 로그아웃 요청을 실행한다', async () => {
  render(<AuthProvider><Probe /></AuthProvider>); emit('first'); await screen.findByText('first');
  mock.cancel.mockRejectedValueOnce(new Error('notification device unavailable'));
  fireEvent.click(screen.getByText('logout'));
  await waitFor(() => expect(mock.signOut).toHaveBeenCalledWith({ scope: 'local' }));
  expect(mock.owner).toHaveBeenCalledWith(null);
});
