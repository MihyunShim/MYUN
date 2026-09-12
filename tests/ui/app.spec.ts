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
  const state = { requestStatus: '', anonymousStarts: 0, failSave: false, linked: false, failRead: false, failLink: false, linkWrites: 0, sosWrites: 0, deletes: 0, schedule: null as null | { user_id: string; scheduled_on: string }, denture: { made_year: 2025, made_month: 1, clinic_name: '시험 치과', clinic_phone: null as string | null }, logs: [] as Record<string, unknown>[] };
  const routines = DEFAULT_ROUTINES.map((r, i) => ({ id: `r${i}`, user_id: elderId, slot: r.slot, label: r.label, alarm_time: r.time, enabled: true }));
  await page.routeWebSocket('wss://denturecare-test.supabase.co/**', (socket) => socket.close());
  await page.route('https://denturecare-test.supabase.co/**', async (route) => {
    const request = route.request(); const url = new URL(request.url());
    const path = url.pathname; const method = request.method();
    const headers = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', 'content-type': 'application/json' };
    if (method === 'OPTIONS') return route.fulfill({ status: 200, headers: { ...headers, 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,HEAD' } });
    const respond = (data: unknown, status = 200, extra = {}) => route.fulfill({ status, headers: { ...headers, ...extra }, body: JSON.stringify(data) });
    if (path.endsWith('/signup')) { state.anonymousStarts++; return respond({ ...session, user: { ...user, is_anonymous: true } }); }
    if (path.endsWith('/token')) return respond(session);
    if (path.endsWith('/user')) return respond(user);
    if (path.endsWith('/logout')) return route.fulfill({ status: 204, headers });
    if (path.endsWith('/rpc/list_my_care_links')) return respond(state.linked ? [{ link_id: 'link', other_name: '시험 가족', relation: '자녀' }] : []);
    if (path.endsWith('/rpc/list_guardian_requests')) return respond(state.requestStatus ? [{ id: 'request', other_name: role === 'A1' ? '시험 보호자' : '틀니 사용자', relation: '어머니', status: state.requestStatus }] : []);
    if (path.endsWith('/rpc/resolve_guardian_request')) { state.requestStatus = request.postDataJSON().accept ? 'approved' : 'rejected'; state.linked = state.requestStatus === 'approved'; return respond(null); }
    if (path.endsWith('/rpc/cancel_guardian_request')) { state.requestStatus = 'cancelled'; return respond(null); }
    if (path.endsWith('/rpc/request_guardian_connection')) {
      state.linkWrites++;
      if (state.failLink) return respond({ message: 'INVALID_CODE' }, 400);
      state.requestStatus = 'pending'; return respond('request');
    }
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
    if (path.endsWith('/dentures')) {
      if (method === 'POST') {
        if (state.failSave) return respond({ message: 'network unavailable' }, 503);
        Object.assign(state.denture, request.postDataJSON()); return respond(state.denture, 201);
      }
      return respond(state.denture);
    }
    if (path.endsWith('/checkup_schedules')) {
      if (method === 'POST') {
        if (state.failSave) return respond({ message: 'network unavailable' }, 503);
        state.schedule = request.postDataJSON(); return respond(state.schedule, 201);
      }
      if (method === 'DELETE') { state.schedule = null; return respond([{ user_id: elderId }]); }
      return respond(state.schedule ? [state.schedule] : []);
    }
    if (path.endsWith('/checkups')) return respond([]);
    if (path.endsWith('/care_links')) {
      if (method === 'HEAD') return route.fulfill({ status: 200, headers: { ...headers, 'content-range': state.linked ? '0-0/1' : '*/0' } });
      if (method === 'PATCH') { state.linked = false; state.requestStatus = 'cancelled'; return respond({ id: 'link' }); }
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
  await page.getByLabel('비밀번호', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
}
async function noOverflow(page: Page) {
  const layout = await page.evaluate(() => ({
    width: window.innerWidth, content: document.documentElement.scrollWidth,
    outside: Array.from(document.querySelectorAll('input, select, label, button, p')).filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
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

test('치과 지정일은 저장 실패 후 재시도·재실행·삭제를 지원한다', async ({ page }, testInfo) => {
  const state = await fixture(page); await login(page);
  await page.getByRole('button', { name: '알겠어요' }).click();
  await page.getByRole('button', { name: '검진', exact: true }).click();
  await page.getByRole('button', { name: '안내받은 검진일 입력하기' }).click();
  const day = new Date(); day.setDate(day.getDate() + 7);
  const date = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  await page.getByLabel('담당 치과에서 정한 검진일').fill(date);
  state.failSave = true;
  await page.getByRole('button', { name: '검진일 저장하기' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(state.schedule).toBeNull();
  state.failSave = false;
  await page.getByRole('button', { name: '검진일 저장하기' }).click();
  await expect(page.getByText('치과에서 안내받은 검진일을 저장했어요.')).toBeVisible();
  expect(state.schedule?.scheduled_on).toBe(date);
  await page.reload();
  await page.getByRole('button', { name: '검진', exact: true }).click();
  await expect(page.getByRole('button', { name: '검진일 변경하기' })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('checkup.png'), fullPage: true });
  await page.getByRole('button', { name: '앱에서 검진일 삭제하기' }).click();
  await page.getByRole('button', { name: '저장한 날짜 삭제', exact: true }).click();
  await expect(page.getByRole('button', { name: '안내받은 검진일 입력하기' })).toBeVisible();
  expect(state.schedule).toBeNull();
});

test('제작 연월은 저장·재실행 후 유지되고 편집하면 이전 성공 표시를 지운다', async ({ page }, testInfo) => {
  const state = await fixture(page); await login(page);
  await page.getByRole('button', { name: '알겠어요' }).click();
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await page.getByLabel('만든 연도', { exact: true }).fill('2020');
  await page.getByRole('combobox', { name: '만든 월', exact: true }).selectOption('3');
  await page.getByRole('button', { name: '틀니 정보 저장', exact: true }).click();
  await expect(page.getByText('· 저장됨 ✓', { exact: true })).toBeVisible();
  expect(state.denture.made_year).toBe(2020); expect(state.denture.made_month).toBe(3);
  await page.getByRole('combobox', { name: '만든 월', exact: true }).selectOption('4');
  await expect(page.getByText('· 저장됨 ✓', { exact: true })).toHaveCount(0);
  state.failSave = true;
  await page.getByRole('button', { name: '틀니 정보 저장', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('연결');
  expect(state.denture.made_month).toBe(3);
  await page.reload();
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await expect(page.getByLabel('만든 연도', { exact: true })).toHaveValue('2020');
  await expect(page.getByRole('combobox', { name: '만든 월', exact: true })).toHaveValue('3');
  await expect(page.getByText(/설치 버전: 2.0.0/)).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('denture-date.png'), fullPage: true });
});

test('보호자는 잘못된 코드 재시도 후 연결·현황 조회·해제까지 진행한다', async ({ page }, testInfo) => {
  const state = await fixture(page, 'A2'); state.failLink = true;
  await page.goto('/');
  await page.getByRole('button', { name: '가족 초대코드가 있어요' }).click();
  await noOverflow(page);
  await page.getByLabel('보호자 이름').fill('시험 가족');
  await page.getByRole('button', { name: '가입 없이 초대코드 입력하기' }).click();
  await expect(page.getByText(/보호자 준비가 완료됐어요/)).toBeVisible();
  await noOverflow(page);
  await expect(page.getByRole('button', { name: '연결 요청하기', exact: true })).toBeDisabled();
  await page.getByLabel('초대코드 (6자리)').fill('ab cd12');
  await expect(page.getByLabel('초대코드 (6자리)')).toHaveValue('ABCD12');
  await page.getByRole('button', { name: '연결 요청하기', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('최신 코드');
  expect(state.linked).toBe(false);
  state.failLink = false;
  await page.getByLabel('초대코드 (6자리)').fill('test01');
  await page.getByRole('button', { name: '아버지', exact: true }).click();
  await page.getByRole('button', { name: '연결 요청하기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '연결 요청을 보냈어요' })).toBeVisible();
  expect(state.linkWrites).toBe(2);
  expect(state.linked).toBe(false);
  expect(state.anonymousStarts).toBe(1);
  await expect(page.getByText(/사용자 승인 대기 중/)).toBeVisible();
  state.linked = true; state.requestStatus = 'approved'; // 별도 사용자 승인에 해당하는 서버 상태
  await page.getByRole('button', { name: '승인 여부 확인 · 가족 현황 보기' }).click();
  await expect(page.getByText('시험 사용자님의 오늘')).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('guardian-connected.png'), fullPage: true });
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await page.getByRole('button', { name: '가족 연결 해제', exact: true }).click();
  await page.getByRole('button', { name: '연결 해제하기', exact: true }).click();
  await expect(page.getByLabel('초대코드 (6자리)')).toBeVisible();
  expect(state.linked).toBe(false);
});

test('사용자는 보호자 요청을 확인하고 승인한다', async ({ page }) => {
  const state = await fixture(page); state.requestStatus = 'pending'; await login(page);
  await page.getByRole('button', { name: '알겠어요' }).click();
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await expect(page.getByText('시험 보호자 · 등록 관계: 어머니')).toBeVisible();
  await page.getByRole('button', { name: '아는 가족이에요 · 연결 승인' }).click();
  await expect.poll(() => state.linked).toBe(true);
});
