import type { CSSProperties, ReactNode } from 'react';

// 고령자 접근성 원칙: 큰 글씨, 48px+ 터치 영역, 고대비 (docs/설계/01)

export function Screen({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      minHeight: '100%', maxWidth: 480, margin: '0 auto',
      padding: '24px 20px 96px', display: 'flex', flexDirection: 'column', gap: 16,
      ...style,
    }}>
      {children}
    </div>
  );
}

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div style={{ textAlign: 'center', margin: '8px 0' }}>
      <h1 style={{ fontSize: 26, color: 'var(--primary)', fontWeight: 800 }}>{children}</h1>
      {sub && <p style={{ color: 'var(--text-sub)', marginTop: 6 }}>{sub}</p>}
    </div>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, padding: 20, ...style,
    }}>
      {children}
    </div>
  );
}

export function BigButton({
  children, onClick, variant = 'primary', disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
}) {
  const styles: Record<string, CSSProperties> = {
    primary: { background: 'var(--primary)', color: '#fff' },
    ghost: { background: 'var(--primary-light)', color: 'var(--primary)' },
    danger: { background: 'var(--danger)', color: '#fff' },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', minHeight: 56, fontSize: 19, fontWeight: 700,
        opacity: disabled ? 0.5 : 1, ...styles[variant],
      }}
    >
      {children}
    </button>
  );
}

export function Field({
  label, value, onChange, type = 'text', placeholder, inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email';
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontWeight: 700 }}>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        style={{
          minHeight: 52, fontSize: 19, padding: '0 16px',
          border: '2px solid var(--border)', borderRadius: 12,
          background: 'var(--surface)', color: 'var(--text)',
        }}
      />
    </label>
  );
}

export function ErrorBox({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div style={{
      background: '#FEF2F2', border: '1px solid #FECACA', color: 'var(--danger)',
      borderRadius: 12, padding: '12px 16px', fontWeight: 600,
    }}>
      {message}
    </div>
  );
}

export function Splash({ text }: { text: string }) {
  return (
    <div style={{
      minHeight: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 12,
      background: 'var(--primary)', color: '#fff',
    }}>
      <div style={{ fontSize: 44 }}>🦷</div>
      <p style={{ fontSize: 22, fontWeight: 800 }}>틀니케어</p>
      <p style={{ opacity: 0.8 }}>{text}</p>
    </div>
  );
}
