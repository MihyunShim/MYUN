// Bound API waits, including a stalled JSON body. Do not retry writes: a lost
// response does not mean the server rolled back a save, request or deletion.
export const API_TIMEOUT_MS = 20_000;

export function createBoundedFetch(fetcher: typeof fetch, timeoutMs = API_TIMEOUT_MS): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const source = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    let timedOut = false;
    const abort = () => controller.abort();
    if (source?.aborted) abort();
    else source?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try {
      const response = await fetcher(input, { ...init, signal: controller.signal });
      // Supabase Auth and PostgREST read JSON after fetch resolves. Keep the
      // deadline until that body has arrived, not just until headers arrive.
      if (response.body && response.headers.get('content-type')?.includes('json')) {
        const body = await response.arrayBuffer();
        return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
      }
      return response;
    } catch (error) {
      if (timedOut) {
        const timeout = new Error('REQUEST_TIMEOUT');
        // PostgREST must not automatically retry an expired read deadline.
        timeout.name = 'AbortError';
        throw timeout;
      }
      throw error;
    } finally {
      clearTimeout(timer);
      source?.removeEventListener('abort', abort);
    }
  };
}
