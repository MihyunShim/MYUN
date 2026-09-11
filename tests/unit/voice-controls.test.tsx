// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { VoiceNotificationControls } from '../../src/components/VoiceNotificationControls';
const native = vi.hoisted(() => ({ prepare: vi.fn(), status: vi.fn(), preview: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'ios' }, registerPlugin: () => native }));
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  native.prepare.mockResolvedValue({ sound: 'denture-care-ko-v1.caf' });
  native.status.mockResolvedValue({ ready: false, reason: 'MISSING_FILE' });
  native.preview.mockResolvedValue({ played: true });
});
afterEach(cleanup);
it('미리 듣기는 파일 준비와 실제 재생 완료 후에만 완료 안내를 표시한다', async () => {
  let finish!: (value: { played: boolean }) => void;
  native.preview.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const busy = vi.fn();
  render(<VoiceNotificationControls disabled={false} onChange={vi.fn()} onBusyChange={busy} />);
  fireEvent.click(screen.getByText('목소리 미리 듣기'));
  await waitFor(() => expect(native.preview).toHaveBeenCalledOnce());
  expect(native.prepare).toHaveBeenCalledWith({ force: false });
  expect(screen.queryByText(/미리 듣기를 마쳤어요/)).toBeNull();
  expect(screen.getByText('음성 다시 준비하기').closest('button')?.disabled).toBe(true);
  finish({ played: true });
  await screen.findByText(/미리 듣기를 마쳤어요/);
  expect(busy.mock.calls.map(([value]) => value)).toEqual([true, false]);
});
it('이전 네이티브 앱에서는 음성 파일 성공 대신 업데이트 안내를 보여준다', async () => {
  native.status.mockRejectedValueOnce({ code: 'UNIMPLEMENTED' });
  render(<VoiceNotificationControls disabled={false} onChange={vi.fn()} onBusyChange={vi.fn()} />);
  expect((await screen.findByRole('alert')).textContent).toContain('다시 설치');
  expect(screen.queryByText(/음성 안내가 준비됐어요/)).toBeNull();
});
it('재생 중단을 음성 확인 완료로 처리하지 않는다', async () => {
  native.preview.mockRejectedValueOnce({ code: 'PREVIEW_INTERRUPTED' });
  render(<VoiceNotificationControls disabled={false} onChange={vi.fn()} onBusyChange={vi.fn()} />);
  fireEvent.click(screen.getByText('목소리 미리 듣기'));
  expect((await screen.findByRole('alert')).textContent).toContain('중단');
  expect(screen.queryByText(/미리 듣기를 마쳤어요/)).toBeNull();
});
it('명시적인 재생성은 캐시를 다시 만들고 기존 알림 재적용을 안내한다', async () => {
  const changed = vi.fn();
  native.status.mockResolvedValue({ ready: true, durationSeconds: 3 });
  render(<VoiceNotificationControls disabled={false} onChange={changed} onBusyChange={vi.fn()} />);
  fireEvent.click(screen.getByText('음성 다시 준비하기'));
  await screen.findByText(/음성을 다시 준비했어요/);
  expect(native.prepare).toHaveBeenCalledWith({ force: true });
  expect(changed).toHaveBeenCalledOnce();
});
it('한국어 음성 없음은 이유를 안내하고 기본음 선택으로 전환할 수 있다', async () => {
  native.prepare.mockRejectedValueOnce({ code: 'VOICE_UNAVAILABLE' });
  render(<VoiceNotificationControls disabled={false} onChange={vi.fn()} onBusyChange={vi.fn()} />);
  fireEvent.click(screen.getByText('음성 다시 준비하기'));
  expect((await screen.findByRole('alert')).textContent).toContain('한국어 음성');
  fireEvent.click(screen.getByLabelText('기본 알림음'));
  expect(localStorage.getItem('denturecare.notification-voice.v1')).toBe('off');
  expect(screen.queryByRole('alert')).toBeNull();
});
