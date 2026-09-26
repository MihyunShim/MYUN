import { useRef, useState } from 'react';
import HomeA1 from './HomeA1';
import ProgressA1 from './ProgressA1';
import CheckupA1 from './CheckupA1';
import SettingsA1 from './SettingsA1';

type Tab = 'home' | 'progress' | 'checkup' | 'settings';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'home', icon: '🏠', label: '홈' },
  { id: 'progress', icon: '📈', label: '진행률' },
  { id: 'checkup', icon: '🦷', label: '검진' },
  { id: 'settings', icon: '⚙️', label: '설정' },
];

// A1 하단 탭 내비게이션 (docs/설계/01 공통 규칙)
export default function A1Shell() {
  const [tab, setTab] = useState<Tab>('home');
  const content = useRef<HTMLElement>(null);
  const selectTab = (next: Tab) => {
    setTab(next);
    requestAnimationFrame(() => content.current?.focus());
  };

  return (
    <div style={{ minHeight: '100%' }}>
      <main ref={content} tabIndex={-1} aria-label={TABS.find((item) => item.id === tab)?.label}>
      {tab === 'home' && <HomeA1 />}
      {tab === 'progress' && <ProgressA1 />}
      {tab === 'checkup' && <CheckupA1 />}
      {tab === 'settings' && <SettingsA1 />}

      </main>
      <nav aria-label="주요 메뉴" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        display: 'flex', background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {TABS.map((t) => (
          <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={() => selectTab(t.id)} style={{
            flex: 1, minWidth: 0, padding: '6px 2px', minHeight: 72, background: 'none', borderRadius: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            justifyContent: 'center',
            color: tab === t.id ? 'var(--primary)' : 'var(--text-sub)',
            fontWeight: tab === t.id ? 800 : 400,
            borderTop: tab === t.id ? '3px solid var(--primary)' : '3px solid transparent',
          }}>
            <span aria-hidden="true" style={{ fontSize: 22 }}>{t.icon}</span>
            <span style={{ fontSize: 'max(16px, 0.9em)' }}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
