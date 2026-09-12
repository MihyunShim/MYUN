// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import A1Shell from '../../src/screens/A1Shell';
import A2Shell from '../../src/screens/A2Shell';
import { BigButton, Modal, Screen, Splash } from '../../src/components/ui';

vi.mock('../../src/screens/HomeA1', () => ({ default: () => <h1>사용자 홈 내용</h1> }));
vi.mock('../../src/screens/HomeA2', () => ({ default: () => <h1>보호자 홈 내용</h1> }));
vi.mock('../../src/screens/ProgressA1', () => ({ default: () => <h1>진행 내용</h1> }));
vi.mock('../../src/screens/CheckupA1', () => ({ default: () => <h1>검진 내용</h1> }));
vi.mock('../../src/screens/SettingsA1', () => ({ default: () => <h1>설정 내용</h1> }));
vi.mock('../../src/screens/ReportA2', () => ({ default: () => <h1>리포트 내용</h1> }));
vi.mock('../../src/screens/AccountScreen', () => ({ default: () => <h1>계정 내용</h1> }));

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0; });
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

for (const [label, Component, destination] of [
  ['사용자', A1Shell, '검진'], ['보호자', A2Shell, '리포트'],
] as const) {
  it(`${label} 메뉴는 선택 상태와 화면 이름을 전달하고 새 내용으로 초점을 옮긴다`, async () => {
    render(<Component />);
    expect(screen.getByRole('navigation', { name: '주요 메뉴' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '홈', exact: true }).getAttribute('aria-current')).toBe('page');
    fireEvent.click(screen.getByRole('button', { name: destination, exact: true }));
    expect(screen.getByRole('button', { name: destination, exact: true }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: '홈', exact: true }).hasAttribute('aria-current')).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('main', { name: destination })));
  });
}
it('공통 동작 버튼은 폼을 의도치 않게 제출하지 않는다', () => {
  const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
  const onClick = vi.fn();
  render(<form onSubmit={onSubmit}><BigButton onClick={onClick}>관리 완료</BigButton></form>);
  fireEvent.click(screen.getByRole('button', { name: '관리 완료' }));
  expect(onClick).toHaveBeenCalledOnce();
  expect(onSubmit).not.toHaveBeenCalled();
});
it('안내 창은 이름 있는 네이티브 모달로 열리고 Escape 취소를 닫기 동작으로 전달한다', () => {
  const close = vi.fn();
  render(<Modal labelledBy="tip-heading" onClose={close}><h2 id="tip-heading">오늘의 정보</h2><button>알겠어요</button></Modal>);
  const dialog = screen.getByRole('dialog', { name: '오늘의 정보' }) as HTMLDialogElement;
  expect(dialog.open).toBe(true);
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(close).toHaveBeenCalledOnce();
});

it('구형 iOS에서는 배경 읽기를 차단하고 Tab 순환·Escape·초점 복귀를 제공한다', () => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, writable: true, value: undefined });
  const root = document.createElement('div'); root.id = 'root';
  const opener = document.createElement('button'); root.append(opener); document.body.append(root); opener.focus();
  const close = vi.fn();
  const view = render(<Modal labelledBy="legacy-title" onClose={close}><h2 id="legacy-title">안내</h2><button>첫 동작</button><a href="https://example.invalid">마지막 동작</a></Modal>);
  expect(root.getAttribute('aria-hidden')).toBe('true');
  const dialog = screen.getByRole('dialog', { name: '안내' });
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '첫 동작' }));
  fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(screen.getByRole('link', { name: '마지막 동작' }));
  fireEvent.keyDown(dialog, { key: 'Tab' });
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '첫 동작' }));
  fireEvent.keyDown(dialog, { key: 'Escape' }); expect(close).toHaveBeenCalledOnce();
  view.unmount();
  expect(root.hasAttribute('aria-hidden')).toBe(false);
  expect(document.activeElement).toBe(opener);
  root.remove();
});

it('화면 전체가 아닌 로딩 안내만 상태 변경을 알린다', () => {
  const view = render(<Screen><h1>오늘의 관리</h1><button>완료</button></Screen>);
  expect(screen.queryByRole('status')).toBeNull();
  view.rerender(<Screen><Splash text="기록 불러오는 중" /></Screen>);
  const statuses = screen.getAllByRole('status');
  expect(statuses).toHaveLength(1);
  expect(statuses[0].textContent).toContain('기록 불러오는 중');
});
