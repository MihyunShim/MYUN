import { useState } from 'react';
import HomeA2 from './HomeA2';
import ReportA2 from './ReportA2';
import AccountScreen from './AccountScreen';

type Tab = 'home' | 'report' | 'settings';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'home', icon: '🏠', label: '홈' },
  { id: 'report', icon: '📊', label: '리포트' },
  { id: 'settings', icon: '⚙️', label: '설정' },
];

// A2 하단 탭 내비게이션 (docs/설계/01 공통 규칙)
export default function A2Shell() {
  const [tab, setTab] = useState<Tab>('home');

  return (
    <div style={{ minHeight: '100%' }}>
      {tab === 'home' && <HomeA2 />}
      {tab === 'report' && <ReportA2 />}
      {tab === 'settings' && <AccountScreen />}

      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        display: 'flex', background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, minHeight: 64, background: 'none', borderRadius: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            justifyContent: 'center',
            color: tab === t.id ? 'var(--primary)' : 'var(--text-sub)',
            fontWeight: tab === t.id ? 800 : 400,
            borderTop: tab === t.id ? '3px solid var(--primary)' : '3px solid transparent',
          }}>
            <span style={{ fontSize: 22 }}>{t.icon}</span>
            <span style={{ fontSize: 13 }}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
