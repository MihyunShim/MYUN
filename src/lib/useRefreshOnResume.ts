import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

// 날짜 변경, 인터넷 재연결, 앱 복귀 시에도 오늘의 기록을 다시 읽는다.
export function useRefreshOnResume(refresh: () => void | Promise<void>): void {
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const run = () => { if (active) void refresh(); };
    const onVisible = () => { if (document.visibilityState === 'visible') run(); };
    const scheduleMidnight = () => {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(() => { run(); scheduleMidnight(); }, midnight.getTime() - now.getTime() + 1000);
    };
    window.addEventListener('online', run);
    document.addEventListener('visibilitychange', onVisible);
    const native = Capacitor.isNativePlatform()
      ? App.addListener('appStateChange', ({ isActive }) => { if (isActive) run(); }).catch(() => null)
      : null;
    scheduleMidnight();
    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener('online', run);
      document.removeEventListener('visibilitychange', onVisible);
      void native?.then((listener) => listener?.remove()).catch(() => undefined);
    };
  }, [refresh]);
}
