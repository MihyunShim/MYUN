import { useCallback, useEffect, useRef } from 'react';

// Reads only. Superseded requests are aborted; late responses cannot restore
// stale data after a refresh, account change, revoked share or screen exit.
export function useLatestRead(scope: string | null | undefined) {
  const current = useRef<AbortController | null>(null);
  useEffect(() => () => { current.current?.abort(); current.current = null; }, [scope]);
  return useCallback(() => {
    current.current?.abort();
    const controller = new AbortController();
    current.current = controller;
    return {
      signal: controller.signal,
      isCurrent: () => current.current === controller && !controller.signal.aborted,
    };
  }, []);
}
