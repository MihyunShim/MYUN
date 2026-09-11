import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// 고령자 접근성 원칙: 큰 글씨, 48px+ 터치 영역, 고대비 (docs/설계/01)

export function Screen({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      minHeight: '100%', maxWidth: 480, margin: '0 auto',
      padding: 'calc(24px + env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) calc(96px + env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left))', display: 'flex', flexDirection: 'column', gap: 16,
      ...style,
    }}>
      {children}
    </div>
  );
}

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div style={{ textAlign: 'center', margin: '8px 0' }}>
      <h1 style={{ fontSize: 'max(26px, 1.35em)', color: 'var(--primary)', fontWeight: 800 }}>{children}</h1>
      {sub && <p style={{ color: 'var(--text-sub)', marginTop: 6 }}>{sub}</p>}
    </div>
  );
}

export function Card({ children, style, className }: { children: ReactNode; style?: CSSProperties; className?: string }) {
  return (
    <div className={className} style={{
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
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', minHeight: 56, padding: '12px 16px', fontSize: 'max(19px, 1em)', fontWeight: 700,
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
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <span style={{ fontWeight: 700 }}>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', minHeight: 52, fontSize: 'max(19px, 1em)', padding: '0 16px',
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
    <div role="alert" style={{
      background: '#FEF2F2', border: '1px solid #FECACA', color: 'var(--danger)',
      borderRadius: 12, padding: '12px 16px', fontWeight: 600,
    }}>
      {message}
    </div>
  );
}

export function Splash({ text }: { text: string }) {
  return (
    <div role="status" aria-live="polite" style={{
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

// Native modal semantics, with a focus/reading-order fallback for older iOS WebViews.
export function Modal({ children, labelledBy, onClose }: {
  children: ReactNode; labelledBy: string; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeAction = useRef(onClose);
  closeAction.current = onClose;
  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    const native = typeof element.showModal === 'function';
    if (native) {
      element.showModal();
      return () => { if (element.open) element.close(); previousFocus?.focus(); };
    }
    // iOS 13–15.3 does not expose HTMLDialogElement.showModal.
    const root = document.getElementById('root');
    const previousHidden = root?.getAttribute('aria-hidden');
    const previousOverflow = document.body.style.overflow;
    element.setAttribute('open', '');
    element.dataset.fallback = 'true';
    const focusable = () => Array.from(element.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]'));
    (focusable()[0] ?? element).focus();
    root?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = 'hidden';
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeAction.current(); }
      if (event.key !== 'Tab') return;
      const nodes = focusable();
      const first = nodes[0] ?? element;
      const last = nodes[nodes.length - 1] ?? element;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === element)) {
        event.preventDefault(); first.focus();
      }
    };
    const blockBackground = (event: Event) => {
      if (!element.contains(event.target as Node)) { event.preventDefault(); event.stopPropagation(); }
    };
    const keepFocus = (event: FocusEvent) => {
      if (!element.contains(event.target as Node)) (focusable()[0] ?? element).focus();
    };
    document.addEventListener('click', blockBackground, true);
    document.addEventListener('focusin', keepFocus);
    element.addEventListener('keydown', trap);
    return () => {
      document.removeEventListener('click', blockBackground, true);
      document.removeEventListener('focusin', keepFocus);
      element.removeEventListener('keydown', trap);
      if (previousHidden == null) root?.removeAttribute('aria-hidden');
      else root?.setAttribute('aria-hidden', previousHidden);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);
  return createPortal(<dialog ref={dialog} role="dialog" aria-modal="true" tabIndex={-1}
    aria-labelledby={labelledBy} className="care-dialog"
    onCancel={(event) => { event.preventDefault(); onClose(); }}>
    {children}
  </dialog>, document.body);
}
