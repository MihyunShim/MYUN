import { validatePrivacyNotice } from './privacy-validation.mjs';

// Public reads only. No account creation, table writes, migrations or email requests.
// Return fixed messages only: never include response bodies, endpoints or keys in reports.
export async function checkServer(env, fetcher = fetch) {
  const checks = [];
  const add = (id, status, detail) => checks.push({ id, status, detail });
  const key = env.VITE_SUPABASE_ANON_KEY || '';
  let publicKey = key.startsWith('sb_publishable_') && key.length > 25;
  try { if (key.split('.').length === 3) publicKey = JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role === 'anon'; } catch { /* invalid */ }
  let url;
  try {
    url = new URL(env.VITE_SUPABASE_URL);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) url = null;
  } catch { /* missing */ }
  if (!url || !publicKey || key.startsWith('sb_secret_') || /YOUR_|test_fixture/i.test(key)) {
    add('connection', 'blocked', '서버 URL과 공개 anon/publishable 키를 확인하세요. 요청하지 않았습니다.');
    return { checks, publicChecksPassed: false };
  }
  async function read(path, method = 'GET') {
    const response = await fetcher(new URL(path, url), {
      method, redirect: 'error', signal: AbortSignal.timeout(12000),
      headers: { apikey: key, 'Content-Type': 'application/json' },
      ...(method === 'POST' ? { body: '{}' } : {}),
    });
    const body = await response.json();
    return { status: response.status, ok: response.ok, body };
  }
  try {
    const { ok, body } = await read('/auth/v1/settings');
    if (!ok || typeof body?.disable_signup !== 'boolean' || typeof body?.external?.email !== 'boolean' || typeof body?.external?.anonymous_users !== 'boolean') {
      add('auth', 'blocked', '인증 설정을 확인하지 못했습니다. 접속 설정과 서버 응답을 확인하세요.');
    } else {
      add('signup', body.disable_signup ? 'blocked' : 'pass', body.disable_signup ? '신규 가입이 비활성화되어 있습니다.' : '신규 가입이 허용되어 있습니다.');
      add('email', body.external.email ? 'pass' : 'blocked', body.external.email ? '이메일 가입이 켜져 있습니다. 실제 메일 수신은 별도 검수해야 합니다.' : '이메일 가입이 꺼져 있습니다.');
      add('anonymous', body.external.anonymous_users ? 'pass' : 'blocked', body.external.anonymous_users ? '보호자 임시 로그인이 켜져 있습니다.' : '보호자 임시 로그인이 꺼져 있습니다.');
      add('email_confirmation', 'info', body.mailer_autoconfirm === true ? '이메일 확인 없이 가입하도록 설정되어 있습니다.' : body.mailer_autoconfirm === false ? '이메일 확인 후 가입하도록 설정되어 있습니다.' : '이메일 확인 설정은 확인되지 않았습니다.');
    }
  } catch { add('auth', 'blocked', '인증 설정 조회가 실패했습니다. 네트워크 또는 응답 형식을 확인하세요.'); }
  try {
    const { ok, status, body } = await read('/rest/v1/rpc/get_privacy_notice', 'POST');
    if (!ok) {
      add('privacy', 'blocked', status === 404 && body?.code === 'PGRST202'
        ? '개인정보 안내 함수가 API에서 발견되지 않습니다. 008 적용 여부와 API 스키마 캐시를 확인하세요.'
        : '개인정보 안내 조회가 실패했습니다. 공개 조회 권한과 서버 상태를 확인하세요.');
    } else if (body === null) {
      add('privacy', 'blocked', '게시된 개인정보 안내가 없습니다. 검토한 안내 게시가 필요합니다.');
    } else if (validatePrivacyNotice(body).length) {
      add('privacy', 'blocked', '개인정보 안내의 필수 정보 또는 검토 상태를 확인해야 합니다.');
    } else {
      add('privacy', 'pass', '공개 안내의 필수 형식을 확인했습니다. 운영 사실과 내용의 정확성은 별도 검토해야 합니다.');
      add('policy_match', env.VITE_PRIVACY_POLICY_URL === body.document.policyUrl ? 'pass' : 'blocked', env.VITE_PRIVACY_POLICY_URL === body.document.policyUrl ? '앱과 서버 안내의 방침 주소가 일치합니다.' : '앱과 서버 안내의 방침 주소를 일치시켜야 합니다.');
    }
  } catch { add('privacy', 'blocked', '개인정보 안내 조회가 실패했습니다. 네트워크 또는 응답 형식을 확인하세요.'); }
  return { checks, publicChecksPassed: checks.every(check => check.status !== 'blocked') };
}
