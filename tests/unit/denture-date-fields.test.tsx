// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DentureDateFields from '../../src/components/DentureDateFields';

function Fields() {
  const [year, setYear] = useState(''); const [month, setMonth] = useState('');
  return <DentureDateFields year={year} month={month} onYearChange={setYear} onMonthChange={setMonth} />;
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 11)); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('제작 시기를 추측하지 않고 빈 입력과 선택 가능한 열두 달을 제공한다', () => {
  render(<Fields />);
  const year = screen.getByRole('textbox', { name: '만든 연도' }) as HTMLInputElement;
  const month = screen.getByRole('combobox', { name: '만든 월' }) as HTMLSelectElement;
  expect(year.value).toBe(''); expect(month.value).toBe('');
  expect(year.maxLength).toBe(4); expect(year.inputMode).toBe('numeric');
  expect(screen.getAllByRole('option')).toHaveLength(13);
  fireEvent.change(year, { target: { value: '2020' } });
  fireEvent.change(month, { target: { value: '3' } });
  expect(month.selectedOptions[0].textContent).toBe('3월');
  expect(month.getAttribute('aria-invalid')).toBe('false');
});

it('같은 해의 미래 월을 두 입력에 설명하고 수정하면 오류를 해제한다', () => {
  render(<Fields />);
  const year = screen.getByLabelText('만든 연도'); const month = screen.getByLabelText('만든 월');
  fireEvent.change(year, { target: { value: '2026' } });
  fireEvent.change(month, { target: { value: '10' } });
  const feedback = screen.getByText(/미래의 제작 시기는 저장할 수 없어요/);
  expect(feedback.getAttribute('aria-live')).toBe('polite');
  for (const field of [year, month]) {
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(field.getAttribute('aria-describedby')).toBe(feedback.id);
  }
  fireEvent.change(month, { target: { value: '9' } });
  expect(screen.queryByText(/미래의 제작 시기는 저장할 수 없어요/)).toBeNull();
  expect(month.getAttribute('aria-invalid')).toBe('false');
});

it.each(['1899', '2027', '2e3', '20'])('허용되지 않는 연도 %s에 입력 범위를 안내한다', (value) => {
  render(<Fields />);
  fireEvent.change(screen.getByLabelText('만든 연도'), { target: { value } });
  expect(screen.getByLabelText('만든 연도').getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByText(/1900년부터 2026년까지 네 자리 숫자/)).toBeTruthy();
});
