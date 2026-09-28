import notice from '../fixtures/privacy-notice.json';
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import OnboardingA2 from '../../src/screens/OnboardingA2';
import { FamilyInviteCard } from '../../src/components/FamilyInviteCard';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), refresh: vi.fn(), copy: vi.fn(), native: vi.fn(), share: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: mocks.native } }));
vi.mock('../../src/lib/db', () => ({ db: () => ({ rpc: mocks.rpc }), friendlyError: () => '최신 코드를 확인해주세요' }));
vi.mock('../../src/state/AuthContext', () => ({ useAuth: () => ({ profile: { invite_code: 'ABC123' }, refresh: mocks.refresh, signOut: vi.fn() }) }));
vi.mock('../../src/components/GuardianRequests', async () => {
  const { useEffect } = await import('react');
  return { GuardianRequests: ({ onPendingChange, reloadKey }: { onPendingChange: (pending: boolean) => void; reloadKey: number }) => {
    useEffect(() => { onPendingChange(reloadKey > 0); }, [onPendingChange, reloadKey]);
    return <p>승인 대기 목록</p>;
  } };
});
vi.mock('../../src/lib/privacy',async()=>{const actual=await vi.importActual<typeof import('../../src/lib/privacy')>('../../src/lib/privacy');return {...actual,usePrivacyNotice:()=>({notice,error:'',loading:false})};});
vi.mock('../../src/screens/AccountScreen', () => ({ default: () => null }));
beforeEach(() => { vi.resetAllMocks(); mocks.native.mockReturnValue(false); Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }); Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: mocks.copy } }); });
afterEach(cleanup);
it('정규화한 코드로 한 번만 연결하고 완료 확인 후 현황을 연다', async () => {
  let finish!: (value: unknown) => void;
  mocks.rpc.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  render(<OnboardingA2 />);
  fireEvent.change(screen.getByLabelText('초대코드 (6자리)'), { target: { value: 'ab c123' } });
  fireEvent.click(screen.getByLabelText('초대코드 사용자에게 내 이름·관계 제공에 동의해요'));
  const form = screen.getByText('연결 요청하기').closest('form')!;
  fireEvent.submit(form); fireEvent.submit(form);
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
  expect(mocks.rpc).toHaveBeenCalledWith('request_guardian_with_consent', { code: 'ABC123', rel: '어머니',notice_version:notice.version,share:true });
  await act(async () => finish({ error: null }));
  expect(mocks.refresh).not.toHaveBeenCalled();
  expect(screen.getByText('연결 요청을 보냈어요')).toBeTruthy();
});
it('잘못된 코드 실패 후 입력을 유지하고 다시 연결한다', async () => {
  mocks.rpc.mockResolvedValueOnce({ error: new Error('INVALID_CODE') }).mockResolvedValueOnce({ error: null });
  render(<OnboardingA2 />);
  fireEvent.change(screen.getByLabelText('초대코드 (6자리)'), { target: { value: 'ABC123' } });
  fireEvent.click(screen.getByLabelText('초대코드 사용자에게 내 이름·관계 제공에 동의해요'));
  fireEvent.click(screen.getByText('연결 요청하기'));
  await screen.findByText('최신 코드를 확인해주세요');
  expect((screen.getByLabelText('초대코드 (6자리)') as HTMLInputElement).value).toBe('ABC123');
  fireEvent.click(screen.getByText('연결 요청하기'));
  await screen.findByText('연결 요청을 보냈어요');
});
it('표시된 초대코드를 복사하고 수동 전달을 안내한다', async () => {
  mocks.copy.mockResolvedValue(undefined);
  render(<FamilyInviteCard />); fireEvent.click(screen.getByText('초대코드 복사'));
  await screen.findByText('초대코드를 복사했어요. 보호자에게 직접 전달해주세요.');
  expect(mocks.copy).toHaveBeenCalledWith('ABC123');
});
it('클립보드 접근 실패 시 직접 복사 방법을 안내한다', async () => {
  mocks.copy.mockRejectedValue(new Error('denied'));
  render(<FamilyInviteCard />); fireEvent.click(screen.getByText('초대코드 복사'));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('길게 눌러'));
});

it('웹 공유 미지원 시 설치 없는 안내를 복사한다', async () => {
  mocks.copy.mockResolvedValue(undefined);
  render(<FamilyInviteCard />);
  fireEvent.click(screen.getByText('가족 초대 보내기'));
  await screen.findByText('초대 내용을 복사했어요. 카카오톡에 붙여넣어 보내주세요.');
  expect(mocks.copy).toHaveBeenCalledWith(expect.stringContaining('웹에서는 앱 설치 없이 이용할 수 있어요.'));
  expect(mocks.copy).toHaveBeenCalledWith(expect.stringContaining('같은 틀니케어 웹 서비스'));
});
it('네이티브 공유 취소 후 재시도할 수 있다', async () => {
  mocks.native.mockReturnValue(true);
  Object.defineProperty(navigator, 'share', { configurable: true, value: mocks.share });
  mocks.share.mockRejectedValueOnce(new DOMException('cancelled', 'AbortError')).mockResolvedValueOnce(undefined);
  render(<FamilyInviteCard />);
  fireEvent.click(screen.getByText('가족 초대 보내기'));
  await screen.findByText('공유를 취소했어요. 다시 보내거나 초대코드를 직접 전달할 수 있어요.');
  fireEvent.click(screen.getByText('가족 초대 보내기'));
  await waitFor(() => expect(mocks.share).toHaveBeenCalledTimes(2));
  expect(mocks.share).toHaveBeenLastCalledWith(expect.objectContaining({ text: expect.stringContaining('앱 또는 웹 서비스') }));
});
it('공유와 복사 모두 미지원이어도 코드를 직접 전달할 수 있다', async () => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  render(<FamilyInviteCard />);
  fireEvent.click(screen.getByText('가족 초대 보내기'));
  await screen.findByText('공유창을 열지 못했어요. 위의 6자리 코드를 직접 알려주거나 초대코드 복사를 눌러주세요.');
  expect(screen.getByLabelText('가족 초대코드 ABC123')).toBeTruthy();
  expect((screen.getByText('가족 초대 보내기') as HTMLButtonElement).disabled).toBe(false);
});
