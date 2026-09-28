import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-expect-error JS CLI module is tested directly.
import { checkServer } from '../../scripts/server-readiness.mjs';
const env = { VITE_SUPABASE_URL: 'https://project.supabase.co', VITE_SUPABASE_ANON_KEY: 'sb_publishable_local_check_only_long_key' };
const auth = { external: { email: true, anonymous_users: true }, disable_signup: false, mailer_autoconfirm: true };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

it('비밀 키나 안전하지 않은 URL을 서버로 보내지 않는다', async () => {
  const fetcher = vi.fn();
  const secretJWT = `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.sig`;
  for (const key of ['sb_secret_sensitive', secretJWT, 'invalid']) {
    expect((await checkServer({ ...env, VITE_SUPABASE_ANON_KEY: key }, fetcher)).publicChecksPassed).toBe(false);
  }
  for (const url of ['http://project.supabase.co', 'https://user:secret@project.supabase.co', 'https://project.supabase.co/?key=secret']) {
    expect((await checkServer({ ...env, VITE_SUPABASE_URL: url }, fetcher)).publicChecksPassed).toBe(false);
  }
  expect(fetcher).not.toHaveBeenCalled();
});
it('함수 미발견과 안내 미게시를 구분하고 SQL 적용 완료로 단정하지 않는다', async () => {
  for (const [body, status, expected] of [[{ code: 'PGRST202' }, 404, '스키마 캐시'], [null, 200, '게시된 개인정보 안내가 없습니다']] as const) {
    const fetcher = vi.fn().mockResolvedValueOnce(response(auth)).mockResolvedValueOnce(response(body, status));
    const result = await checkServer(env, fetcher);
    expect(result.publicChecksPassed).toBe(false);
    expect(result.checks.find((c: {id:string}) => c.id === 'privacy').detail).toContain(expected);
    expect(fetcher.mock.calls.map(call => [new URL(call[0]).pathname, call[1].method])).toEqual([
      ['/auth/v1/settings', 'GET'], ['/rest/v1/rpc/get_privacy_notice', 'POST'],
    ]);
    expect(fetcher.mock.calls[1][1].body).toBe('{}');
    expect(fetcher.mock.calls[0][1].redirect).toBe('error');
  }
});
it('가입 제한과 보호자 임시 로그인 비활성화를 각각 표시한다', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(response({ ...auth, disable_signup: true, external: { email: true, anonymous_users: false } })).mockResolvedValueOnce(response(null));
  const result = await checkServer(env, fetcher);
  expect(result.checks).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'signup', status: 'blocked' }),
    expect.objectContaining({ id: 'anonymous', status: 'blocked' }),
  ]));
});
it('잘못된 성공 응답은 준비 완료로 표시하지 않는다', async () => {
  const result = await checkServer(env, vi.fn().mockImplementation(() => response({})));
  expect(result.publicChecksPassed).toBe(false);
  expect(result.checks.filter((c: {status:string}) => c.status === 'pass')).toHaveLength(0);
});
it('네트워크 실패와 서버 오류 본문에 포함된 키를 보고서에 노출하지 않는다', async () => {
  const fetcher = vi.fn().mockRejectedValueOnce(new Error(env.VITE_SUPABASE_ANON_KEY)).mockResolvedValueOnce(response({ message: env.VITE_SUPABASE_ANON_KEY }, 500));
  const result = await checkServer(env, fetcher);
  expect(result.publicChecksPassed).toBe(false);
  expect(JSON.stringify(result)).not.toContain(env.VITE_SUPABASE_ANON_KEY);
  expect(JSON.stringify(result)).not.toContain(env.VITE_SUPABASE_URL);
});

it('안내 형식과 앱 URL 일치 여부를 구분한다', async () => {
  // Synthetic responses only; never sent to a real server or published.
  const notice = JSON.parse(readFileSync('tests/fixtures/privacy-notice.json', 'utf8').replaceAll('테스트 전용', '검증용').replaceAll('시험 전용', '검증용').replaceAll('example.invalid', 'denturecare.qa'));
  for (const [policyURL, expected] of [[notice.document.policyUrl, true], ['', false]]) {
    const fetcher = vi.fn().mockResolvedValueOnce(response(auth)).mockResolvedValueOnce(response(notice));
    const result = await checkServer({ ...env, VITE_PRIVACY_POLICY_URL: policyURL }, fetcher);
    expect(result.publicChecksPassed).toBe(expected);
    expect(result.checks.find((c: {id:string}) => c.id === 'privacy').status).toBe('pass');
  }
});
