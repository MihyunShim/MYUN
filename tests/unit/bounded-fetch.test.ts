import { afterEach, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createBoundedFetch } from '../../src/lib/boundedFetch';

const stalled = (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => new Promise((_, reject) => {
  const stop = () => reject(new DOMException('Aborted', 'AbortError'));
  if (init?.signal?.aborted) stop();
  else init?.signal?.addEventListener('abort', stop, { once: true });
});
afterEach(() => vi.useRealTimers());
it('JSON 응답과 상태·헤더를 보존하고 타이머를 정리한다', async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 201, headers: { 'content-type': 'application/json', 'content-range': '0-4/5' } }));
  const response = await createBoundedFetch(fetcher)('https://test.invalid');
  expect(await response.json()).toEqual({ ok: true });
  expect(response.status).toBe(201); expect(response.headers.get('content-range')).toBe('0-4/5');
  expect(vi.getTimerCount()).toBe(0);
});
it('지연된 조회는 SDK의 자동 재시도 없이 한 번에 끝난다', async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn(stalled);
  const client = createClient('https://test.invalid', 'public-test-key', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: createBoundedFetch(fetcher, 50) } });
  const result = Promise.resolve(client.from('records').select('*'));
  await vi.advanceTimersByTimeAsync(100);
  expect((await result).error?.message).toContain('REQUEST_TIMEOUT');
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
it('시간 초과된 저장 요청을 다시 보내지 않는다', async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn(stalled);
  const client = createClient('https://test.invalid', 'public-test-key', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: createBoundedFetch(fetcher, 50) } });
  const result = Promise.resolve(client.from('records').insert({ value: 'test' }));
  await vi.advanceTimersByTimeAsync(100);
  expect((await result).error?.message).toContain('REQUEST_TIMEOUT');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('헤더 도착 후 JSON 본문이 멈춰도 제한 시간이 적용된다', async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn(async (_input, init) => new Response(new ReadableStream({ start(controller) {
    init.signal.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')));
  } }), { headers: { 'content-type': 'application/json' } }));
  const result = createBoundedFetch(fetcher, 50)('https://test.invalid');
  const assertion = expect(result).rejects.toThrow('REQUEST_TIMEOUT');
  await vi.advanceTimersByTimeAsync(50); await assertion;
  expect(vi.getTimerCount()).toBe(0);
});
it('화면 전환 취소를 실제 요청으로 전달하고 제한 시간 오류로 바꾸지 않는다', async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const result = createBoundedFetch(stalled, 50)('https://test.invalid', { signal: controller.signal });
  const assertion = expect(result).rejects.toMatchObject({ name: 'AbortError', message: 'Aborted' });
  controller.abort(); await assertion;
  expect(vi.getTimerCount()).toBe(0);
});
it('빈 응답과 HTTP 오류 상태도 그대로 전달한다', async () => {
  expect((await createBoundedFetch(vi.fn().mockResolvedValue(new Response(null, { status: 204 })))('https://test.invalid')).status).toBe(204);
  const response = await createBoundedFetch(vi.fn().mockResolvedValue(new Response('{"message":"denied"}', { status: 403, headers: { 'content-type': 'application/json' } })))('https://test.invalid');
  expect(response.status).toBe(403); expect(await response.json()).toEqual({ message: 'denied' });
});
