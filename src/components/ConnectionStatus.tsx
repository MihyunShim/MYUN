import { useEffect, useState } from 'react';

export function ConnectionStatus() {
  const [offline, setOffline] = useState(() => !navigator.onLine);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  if (!offline) return null;
  return <div role="status" style={{ padding: 'calc(12px + env(safe-area-inset-top)) 20px 12px', background: '#FEF3C7', color: 'var(--text)' }}>
    인터넷이 연결되지 않았어요. 연결을 복구한 뒤 저장 버튼을 다시 눌러주세요.
  </div>;
}
