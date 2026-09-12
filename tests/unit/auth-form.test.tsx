// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Auth from '../../src/screens/Auth';
const mocks = vi.hoisted(() => ({ login: vi.fn(), signup: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('../../src/lib/db', () => ({ db: () => ({ auth: { signInWithPassword: mocks.login, signUp: mocks.signup } }), friendlyError: () => '연결 실패' }));
vi.mock('../../src/lib/kakao', () => ({ kakaoLogin: vi.fn(), rememberPendingRole: vi.fn(), clearPendingRole: vi.fn() }));
vi.mock('../../src/components/AccountActions', () => ({ AppInformation: () => <p>앱 안내</p> }));
beforeEach(() => vi.clearAllMocks()); afterEach(cleanup);
it('로그인 양식에 자동완성 정보를 제공하고 중복 제출을 차단한다', async () => {
  mocks.login.mockImplementation(() => new Promise(() => {}));
  render(<Auth />); fireEvent.click(screen.getByText('이미 계정이 있어요 (로그인)'));
  const email = screen.getByLabelText('이메일'); const password = screen.getByLabelText('비밀번호');
  expect(email.getAttribute('autocomplete')).toBe('username');
  expect(password.getAttribute('autocomplete')).toBe('current-password');
  fireEvent.change(email, { target: { value: 'a@example.com' } });
  fireEvent.change(password, { target: { value: 'password' } });
  fireEvent.submit(email.closest('form')!); fireEvent.submit(email.closest('form')!);
  await waitFor(() => expect(mocks.login).toHaveBeenCalledTimes(1));
  expect(screen.queryByText('💬 카카오로 시작하기')).toBeNull();
});
it('보호자 역할을 라디오로 선택하고 가입용 비밀번호 자동완성을 제공한다', () => {
  render(<Auth />); fireEvent.click(screen.getByText('처음이에요 (회원가입)'));
  fireEvent.click(screen.getByRole('radio', { name: /가족을 도와드려요/ }));
  fireEvent.click(screen.getByText('다음'));
  expect(screen.getByLabelText('비밀번호').getAttribute('autocomplete')).toBe('new-password');
  fireEvent.click(screen.getByText('비밀번호 보기'));
  expect(screen.getByLabelText('비밀번호').getAttribute('type')).toBe('text');
});

it('초대받은 가족은 전용 버튼으로 보호자 역할이 지정된 가입을 진행한다', async () => {
  mocks.signup.mockResolvedValue({ data: { session: null }, error: null });
  render(<Auth />);
  fireEvent.click(screen.getByText('가족 초대코드가 있어요'));
  fireEvent.click(screen.getByText('보호자 회원가입 후 연결하기'));
  fireEvent.change(screen.getByLabelText('이름'), { target: { value: '보호자' } });
  fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'family@example.com' } });
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'password' } });
  fireEvent.submit(screen.getByLabelText('이메일').closest('form')!);
  await screen.findByText('📮 이메일을 확인해주세요');
  expect(mocks.signup).toHaveBeenCalledWith(expect.objectContaining({ options: { data: { role: 'A2', name: '보호자' } } }));
  fireEvent.click(screen.getByText('로그인 화면으로'));
  expect(screen.getByRole('heading').textContent).toBe('보호자 로그인');
});
it('이미 가입한 보호자는 초대 진입에서 가입 없이 로그인할 수 있다', () => {
  render(<Auth />); fireEvent.click(screen.getByText('가족 초대코드가 있어요'));
  fireEvent.click(screen.getByText('보호자 계정으로 로그인하기'));
  expect(screen.queryByLabelText('이름')).toBeNull();
  expect(screen.getByRole('heading').textContent).toBe('보호자 로그인');
  fireEvent.click(screen.getByText('뒤로'));
  expect(screen.getByText('보호자 회원가입 후 연결하기')).toBeTruthy();
});
