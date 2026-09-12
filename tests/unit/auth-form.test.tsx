// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Auth from '../../src/screens/Auth';
const mocks = vi.hoisted(() => ({ login: vi.fn(), signup: vi.fn(), anonymous: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('../../src/lib/db', () => ({ db: () => ({ auth: { signInWithPassword: mocks.login, signUp: mocks.signup, signInAnonymously: mocks.anonymous } }), friendlyError: () => '연결 실패' }));
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
it('보호자 선택은 이메일 가입 대신 이름만 받는 화면으로 이어진다', () => {
  render(<Auth />); fireEvent.click(screen.getByText('처음이에요 (회원가입)'));
  fireEvent.click(screen.getByRole('radio', { name: /가족을 도와드려요/ }));
  fireEvent.click(screen.getByText('다음'));
  expect(screen.queryByLabelText('이메일')).toBeNull();
  expect(screen.getByLabelText('보호자 이름')).toBeTruthy();
});
it('가입 없이 시작할 때 보호자 역할과 이름을 보내며 이메일 가입은 호출하지 않는다', async () => {
  mocks.anonymous.mockResolvedValue({ error: null });
  render(<Auth />); fireEvent.click(screen.getByText('가족 초대코드가 있어요'));
  fireEvent.change(screen.getByLabelText('보호자 이름'), { target: { value: ' 가족 ' } });
  fireEvent.click(screen.getByText('가입 없이 초대코드 입력하기'));
  await waitFor(() => expect(mocks.anonymous).toHaveBeenCalledWith({ options: { data: { role: 'A2', name: '가족' } } }));
  expect(mocks.signup).not.toHaveBeenCalled(); expect(mocks.login).not.toHaveBeenCalled();
});
it('익명 인증 실패 후 이름을 유지하고 재시도할 수 있다', async () => {
  mocks.anonymous.mockResolvedValueOnce({ error: new Error('disabled') }).mockResolvedValueOnce({ error: null });
  render(<Auth />); fireEvent.click(screen.getByText('가족 초대코드가 있어요'));
  fireEvent.change(screen.getByLabelText('보호자 이름'), { target: { value: '가족' } });
  fireEvent.click(screen.getByText('가입 없이 초대코드 입력하기'));
  await screen.findByText('연결 실패');
  fireEvent.click(screen.getByText('가입 없이 초대코드 입력하기'));
  await waitFor(() => expect(mocks.anonymous).toHaveBeenCalledTimes(2));
});
it('기존 보호자 계정의 이메일 로그인은 유지한다', () => {
  render(<Auth />); fireEvent.click(screen.getByText('가족 초대코드가 있어요'));
  fireEvent.click(screen.getByText('보호자 계정으로 로그인하기'));
  expect(screen.getByLabelText('이메일')).toBeTruthy();
});
