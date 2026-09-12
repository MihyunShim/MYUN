import { useId, type CSSProperties } from 'react';
import { isValidDentureDate } from '../lib/dates';

export default function DentureDateFields({ year, month, onYearChange, onMonthChange, disabled = false }: {
  year: string; month: string;
  onYearChange: (value: string) => void; onMonthChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const currentYear = new Date().getFullYear();
  const badYear = !!year && (!/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > currentYear);
  const badMonth = !!month && (!/^([1-9]|1[0-2])$/.test(month));
  const futureDate = !badYear && !badMonth && !!year && !!month && !isValidDentureDate(Number(year), Number(month));
  const error = badYear ? `만든 연도는 1900년부터 ${currentYear}년까지 네 자리 숫자로 입력해주세요.`
    : badMonth ? '만든 월을 1월부터 12월 중에서 선택해주세요.'
      : futureDate ? '미래의 제작 시기는 저장할 수 없어요. 만든 연도와 월을 확인해주세요.' : '';
  const controlStyle: CSSProperties = {
    boxSizing: 'border-box', width: '100%', minWidth: 0, minHeight: 52, padding: '8px 12px',
    font: 'inherit', border: '2px solid var(--border)', borderRadius: 12,
    background: 'var(--surface)', color: 'var(--text)',
  };
  return <div style={{ minWidth: 0 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 9em), 1fr))', gap: 12, minWidth: 0 }}>
      <label htmlFor={`${id}-year`} style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        <span style={{ fontWeight: 700 }}>만든 연도</span>
        <input id={`${id}-year`} type="text" inputMode="numeric" maxLength={4} placeholder="예) 2024"
          value={year} disabled={disabled} onChange={(event) => onYearChange(event.target.value)}
          aria-invalid={badYear || futureDate} aria-describedby={error ? `${id}-error` : undefined} style={controlStyle} />
      </label>
      <label htmlFor={`${id}-month`} style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        <span style={{ fontWeight: 700 }}>만든 월</span>
        <select id={`${id}-month`} value={month} disabled={disabled} onChange={(event) => onMonthChange(event.target.value)}
          aria-invalid={badMonth || futureDate} aria-describedby={error ? `${id}-error` : undefined} style={controlStyle}>
          <option value="">월 선택</option>
          {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}월</option>)}
        </select>
      </label>
    </div>
    <p id={`${id}-error`} aria-live="polite" style={{ color: 'var(--danger)', marginTop: error ? 8 : 0, overflowWrap: 'anywhere' }}>{error}</p>
  </div>;
}
