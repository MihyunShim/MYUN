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
