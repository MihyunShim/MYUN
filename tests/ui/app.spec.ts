import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_ROUTINES } from '../../src/lib/types';

// 모든 API 요청을 가짜 데이터로 응답한다. 실제 Supabase 계정과 환자 데이터를 사용하지 않는다.
async function fixture(page: Page, role: 'A1' | 'A2' = 'A1') {
  const elderId = '00000000-0000-4000-8000-000000000001';
  const id = role === 'A1' ? elderId : '00000000-0000-4000-8000-000000000002';
  const user = { id, email: 'test@example.invalid', app_metadata: { provider: 'email' }, user_metadata: {}, aud: 'authenticated', created_at: '2026-01-01T00:00:00Z' };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const access = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })}.fixture`;
  const session = { access_token: access, token_type: 'bearer', expires_in: 3600, refresh_token: 'fixture', user };
  const profile = { id, name: '시험 사용자', role, birth_year: 1950, invite_code: 'TEST01', font_size_mode: 'large' };
  const state = { failSave: false, linked: false, failRead: false, sosWrites: 0, deletes: 0, logs: [] as Record<string, unknown>[] };
  const routines = DEFAULT_ROUTINES.map((r, i) => ({ id: `r${i}`, user_id: elderId, slot: r.slot, label: r.label, alarm_time: r.time, enabled: true }));
  await page.routeWebSocket('wss://denturecare-test.supabase.co/**', (socket) => socket.close());
  await page.route('https://denturecare-test.supabase.co/**', async (route) => {
    const request = route.request(); const url = new URL(request.url());
    const path = url.pathname; const method = request.method();
    const headers = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', 'content-type': 'application/json' };
    if (method === 'OPTIONS') return route.fulfill({ status: 200, headers: { ...headers, 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,HEAD' } });
    const respond = (data: unknown, status = 200, extra = {}) => route.fulfill({ status, headers: { ...headers, ...extra }, body: JSON.stringify(data) });
    if (path.endsWith('/token')) return respond(session);
    if (path.endsWith('/user')) return respond(user);
    if (path.endsWith('/logout')) return route.fulfill({ status: 204, headers });
    if (path.endsWith('/rpc/list_my_care_links')) return respond(state.linked ? [{ link_id: 'link', other_name: '시험 가족', relation: '자녀' }] : []);
    if (path.endsWith('/rpc/delete_own_account')) { state.deletes++; return respond(null); }
    if (path.endsWith('/profiles')) {
      if (method === 'PATCH') { Object.assign(profile, request.postDataJSON()); return respond({ id }); }
      return respond(url.searchParams.get('id')?.includes(elderId) && role === 'A2' ? { ...profile, id: elderId, role: 'A1' } : profile);
    }
    if (path.endsWith('/routines')) {
      if (method === 'HEAD') return route.fulfill({ status: 200, headers: { ...headers, 'content-range': '0-4/5' } });
      if (method === 'PATCH') {
        if (state.failSave) return respond({ message: 'network unavailable' }, 503);
        const routine = routines.find((r) => `eq.${r.id}` === url.searchParams.get('id'))!;
        Object.assign(routine, request.postDataJSON()); return respond({ id: routine.id });
      }
      return respond(routines);
    }
    if (path.endsWith('/routine_logs')) {
      if (method === 'POST') {
        if (state.failSave) return respond({ message: 'network unavailable' }, 503);
        state.logs.push({ ...request.postDataJSON(), id: 'log', done_at: new Date().toISOString() }); return respond(null, 201);
      }
      if (method === 'DELETE') { state.logs = []; return respond(null); }
      return respond(state.logs);
    }
    if (path.endsWith('/dentures')) return respond({ made_year: 2025, made_month: 1, clinic_name: '시험 치과', clinic_phone: null });
    if (path.endsWith('/checkups')) return respond([]);
    if (path.endsWith('/care_links')) {
      if (method === 'HEAD') return route.fulfill({ status: 200, headers: { ...headers, 'content-range': state.linked ? '0-0/1' : '*/0' } });
      if (method === 'PATCH') { state.linked = false; return respond({ id: 'link' }); }
      return respond(state.linked ? [{ id: 'link', elder_id: elderId }] : []);
    }
    if (path.endsWith('/alerts')) {
      if (method === 'POST') { state.sosWrites++; return respond(null, 201); }
      if (method === 'PATCH') return state.failRead ? respond({ message: 'network unavailable' }, 503) : respond({ id: 'alert' });
      return respond([{ id: 'alert', elder_id: elderId, type: 'emergency', detail: 'gum_pain', created_at: new Date().toISOString(), read_at: null }]);
    }
    throw new Error(`Unexpected fixture request: ${method} ${path}`);
  });
  return state;
}
async function login(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '이미 계정이 있어요 (로그인)' }).click();
  await page.getByLabel('이메일').fill('test@example.invalid');
  await page.getByLabel('비밀번호').fill('fixture-password');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
}
async function noOverflow(page: Page) {
  const layout = await page.evaluate(() => ({
    width: window.innerWidth, content: document.documentElement.scrollWidth,
    outside: Array.from(document.querySelectorAll('input, label, button, p')).filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
      .map((el) => ({ tag: el.tagName, label: el.getAttribute('aria-label') || el.textContent?.slice(0, 40), right: el.getBoundingClientRect().right })),
  }));
  expect(layout.content <= layout.width, JSON.stringify(layout)).toBe(true);
}
test('기록 저장 실패를 표시하고 재시도·재실행 시 완료 기록을 유지한다', async ({ page }, testInfo) => {
  const state = await fixture(page); await login(page);
  await page.getByRole('button', { name: '알겠어요' }).click();
  state.failSave = true;
  await page.getByRole('button', { name: '했어요 ✓', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('연결');
  await expect(page.getByText('0 / 5 완료')).toBeVisible();
  state.failSave = false;
  await page.getByRole('button', { name: '했어요 ✓', exact: true }).click();
  await expect(page.getByText('1 / 5 완료')).toBeVisible();
  await page.reload(); await expect(page.getByText('1 / 5 완료')).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true });
});
test('연결된 가족이 없으면 도움 요청을 전송했다고 표시하지 않는다', async ({ page }) => {
  const state = await fixture(page); await login(page);
  await page.getByRole('button', { name: '알겠어요' }).click();
  await page.getByRole('button', { name: /아파요, 도움이 필요해요/ }).click();
  await page.getByRole('button', { name: /잇몸이 아파요/ }).click();
  await expect(page.getByRole('alert')).toContainText('연결된 가족이 없어요');
  expect(state.sosWrites).toBe(0);
  await expect(page.getByText('도움 요청을 남겼어요 ✓')).toHaveCount(0);
});
test('설정은 저장 실패와 미래 제작일을 처리하고 탈퇴에 명시적 확인을 요구한다', async ({ page }, testInfo) => {
  const state = await fixture(page); await login(page);
  await page.getByRole('button', { name: '알겠어요' }).click();
  await page.getByRole('button', { name: /설정/ }).click();
  await page.getByRole('button', { name: '보통', exact: true }).click();
  await expect(page.locator('html')).toHaveCSS('--font-body', '18px');
  await expect(page.getByRole('heading', { name: '설정', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '크게', exact: true }).click();
  await expect(page.locator('html')).toHaveCSS('--font-body', '22px');
  state.failSave = true;
  await page.getByLabel('아침 식후 알림 시간').fill('09:00');
  await expect(page.getByRole('alert')).toContainText('연결');
  await expect(page.getByLabel('아침 식후 알림 시간')).toHaveValue('08:00');
  await expect(page.getByText('· 저장됨 ✓', { exact: true })).toHaveCount(0);
  await page.getByLabel('만든 연도').fill('2999');
  await expect(page.getByRole('button', { name: '틀니 정보 저장' })).toBeDisabled();
  await page.getByRole('button', { name: '회원 탈퇴' }).click();
  await expect(page.getByRole('button', { name: '계정과 기록 영구 삭제' })).toBeDisabled();
  await page.getByLabel('확인하려면 ‘탈퇴’를 입력해주세요').fill('탈퇴');
  await expect(page.getByRole('button', { name: '계정과 기록 영구 삭제' })).toBeEnabled();
  expect(state.deletes).toBe(0);
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('settings.png'), fullPage: true });
});
test('보호자 화면은 조회 실패를 빈 기록으로 표시하지 않는다', async ({ page }) => {
  const state = await fixture(page, 'A2'); state.linked = true; state.failRead = true;
  await login(page);
  await expect(page.getByText(/도움 요청 푸시 알림은 오지 않아요/)).toBeVisible();
  await page.getByRole('button', { name: '확인했어요' }).click();
  await expect(page.getByRole('alert')).toContainText('연결');
  await expect(page.getByRole('button', { name: '가족 현황 다시 불러오기' })).toBeVisible();
  await noOverflow(page);
});
