import { isSupabaseConfigured } from './lib/supabase';

// Phase 2 시작점: 개발 환경 확인 화면
// 다음 단계에서 프로토타입 v12의 화면들이 이 자리로 이식됩니다 (docs/설계/01 순서대로)
export default function App() {
  return (
    <div style={{
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: 24,
      textAlign: 'center',
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 18,
        background: 'var(--primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 36,
      }}>
        🦷
      </div>
      <h1 style={{ fontSize: 26, color: 'var(--primary)' }}>틀니케어</h1>
      <p style={{ color: 'var(--text-sub)' }}>정식 개발 버전 (v2) 준비 중</p>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '16px 24px',
      }}>
        서버 연결 설정: {isSupabaseConfigured
          ? <strong style={{ color: 'var(--success)' }}>완료 ✓</strong>
          : <strong style={{ color: 'var(--warning)' }}>대기 중 (.env 필요)</strong>}
      </div>
    </div>
  );
}
