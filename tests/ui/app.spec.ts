import { readFileSync } from 'node:fs';
const privacyNotice=JSON.parse(readFileSync(new URL('../fixtures/privacy-notice.json',import.meta.url),'utf8'));
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
  const state = { consent:true, health:true, notice:true, signupCalls:0, privacyChoices:null as unknown, privacyRequests:[] as {id:string;kind:string;status:string;created_at:string}[], visits: [] as { id: string; visited_on: string }[], requestStatus: '', anonymousStarts: 0, failSave: false, linked: false, failRead: false, failLink: false, linkWrites: 0, sosWrites: 0, deletes: 0, schedule: null as null | { user_id: string; scheduled_on: string }, denture: { made_year: 2025, made_month: 1, clinic_name: '시험 치과', clinic_phone: null as string | null }, logs: [] as Record<string, unknown>[] };
  const routines = DEFAULT_ROUTINES.map((r, i) => ({ id: `r${i}`, user_id: elderId, slot: r.slot, label: r.label, alarm_time: r.time, enabled: true }));
  await page.routeWebSocket('wss://denturecare-test.supabase.co/**', (socket) => socket.close());
  await page.route('https://denturecare-test.supabase.co/**', async (route) => {
    const request = route.request(); const url = new URL(request.url());
    const path = url.pathname; const method = request.method();
    const headers = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', 'content-type': 'application/json' };
    if (method === 'OPTIONS') return route.fulfill({ status: 200, headers: { ...headers, 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,HEAD' } });
    const respond = (data: unknown, status = 200, extra = {}) => route.fulfill({ status, headers: { ...headers, ...extra }, body: JSON.stringify(data) });
    if (path.endsWith('/signup')) { state.anonymousStarts++;state.signupCalls++;state.privacyChoices=request.postDataJSON().data?.privacy;state.health=request.postDataJSON().data?.privacy?.sensitive===true; return respond({ ...session, user: { ...user, is_anonymous: true } }); }
    if (path.endsWith('/token')) return respond(session);
    if (path.endsWith('/user')) return respond(user);
    if (path.endsWith('/logout')) return route.fulfill({ status: 204, headers });
    if (path.endsWith('/rpc/get_privacy_notice')) return respond(state.notice?privacyNotice:null);
    if (path.endsWith('/rpc/get_privacy_status')) return respond({personal:state.consent,sensitive:state.health});
    if (path.endsWith('/rpc/accept_privacy_consent')) {state.privacyChoices=request.postDataJSON().choices;state.consent=true;state.health=request.postDataJSON().choices.sensitive;return respond(null);}
    if (path.endsWith('/rpc/get_care_profile')) return respond({name:'시험 사용자'});
    if (path.endsWith('/rpc/list_privacy_events')) return respond([]);
    if (path.endsWith('/rpc/list_privacy_requests')) return respond(state.privacyRequests);
    if (path.endsWith('/rpc/submit_privacy_request')) {state.privacyRequests.push({id:'privacy-request',kind:request.postDataJSON().request_kind,status:'received',created_at:new Date().toISOString()});return respond('privacy-request');}
    if (path.endsWith('/rpc/withdraw_health_consent')) {state.health=false;state.linked=false;return respond(null);}
    if (path.endsWith('/rpc/clear_legacy_profile_fields')) {profile.birth_year=0;return respond(null);}
    if (path.endsWith('/rpc/approve_guardian_with_consent')) {state.linked=true;state.requestStatus='approved';return respond(null);}
    if (path.endsWith('/rpc/count_sharing_guardians')) return respond(state.linked?1:0);
    if (path.endsWith('/rpc/list_my_care_links')) return respond(state.linked ? [{ link_id: 'link', other_name: '시험 가족', relation: '자녀' }] : []);
    if (path.endsWith('/rpc/list_guardian_requests')) return respond(state.requestStatus ? [{ id: 'request', other_name: role === 'A1' ? '시험 보호자' : '틀니 사용자', relation: '어머니', status: state.requestStatus, expires_at: new Date(Date.now() + 86400000).toISOString() }] : []);
    if (path.endsWith('/rpc/resolve_guardian_request')) { state.requestStatus = request.postDataJSON().accept ? 'approved' : 'rejected'; state.linked = state.requestStatus === 'approved'; return respond(null); }
    if (path.endsWith('/rpc/cancel_guardian_request')) { state.requestStatus = 'cancelled'; return respond(null); }
    if (path.endsWith('/rpc/request_guardian_with_consent')) {
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
    if (path.endsWith('/rpc/save_checkup_visit')) {
      if (state.failSave) return respond({ message: 'network unavailable' }, 503);
      const data = request.postDataJSON();
      if (data.visit_id) state.visits.find(v => v.id === data.visit_id)!.visited_on = data.visit_date;
      else if (!state.visits.some(v => v.visited_on === data.visit_date)) state.visits.push({ id: 'visit', visited_on: data.visit_date });
      return respond('visit');
    }
    if (path.endsWith('/rpc/delete_checkup_visit')) {
      if (state.failSave) return respond({ message: 'network unavailable' }, 503);
      state.visits = state.visits.filter(v => v.id !== request.postDataJSON().visit_id); return respond(null);
    }
    if (path.endsWith('/checkups')) return respond(state.visits);
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
  await expect(page.getByRole('alert')).toContainText('공유 동의를 완료한 가족이 없어요');
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
  await page.getByRole('button', { name: '아침 식후 시간 저장', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('연결');
  await expect(page.getByLabel('아침 식후 알림 시간')).toHaveValue('09:00');
  state.failSave = false;
  await page.getByRole('button', { name: '아침 식후 시간 저장', exact: true }).click();
  await expect(page.getByText('아침 식후 시간을 저장했어요.')).toBeVisible();
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
  await page.getByLabel('만 14세 이상이에요').check();
  await page.getByLabel('[필수] 개인정보 수집·이용에 동의해요').check();
  await page.getByLabel('[필수] 개인정보 국외 이전에 동의해요').check();
  await page.getByRole('button', { name: '가입 없이 초대코드 입력하기' }).click();
  await expect(page.getByText(/보호자 준비가 완료됐어요/)).toBeVisible();
  await noOverflow(page);
  await expect(page.getByRole('button', { name: '연결 요청하기', exact: true })).toBeDisabled();
  await page.getByLabel('초대코드 (6자리)').fill('ab cd12');
  await expect(page.getByLabel('초대코드 (6자리)')).toHaveValue('ABCD12');
  await page.getByLabel('초대코드 사용자에게 내 이름·관계 제공에 동의해요').check();
  await page.getByRole('button', { name: '연결 요청하기', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('최신 코드');
  expect(state.linked).toBe(false);
  state.failLink = false;
  await page.getByLabel('초대코드 (6자리)').fill('test01');
  await page.getByRole('button', { name: '아버지', exact: true }).click();
  await page.getByLabel('초대코드 사용자에게 내 이름·관계 제공에 동의해요').check();
  await page.getByRole('button', { name: '연결 요청하기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '연결 요청을 보냈어요' })).toBeVisible();
  expect(state.linkWrites).toBe(2);
  expect(state.linked).toBe(false);
  expect(state.anonymousStarts).toBe(1);
  await expect(page.getByText(/사용자 승인 대기 중/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '승인을 기다리고 있어요' })).toBeVisible();
  await expect(page.getByLabel('초대코드 (6자리)')).toHaveCount(0);
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
  await expect(page.getByRole('button',{name:'동의하고 가족에게 공유'})).toBeDisabled();
  await page.getByLabel('[선택] 이 가족에게 개인정보 제공에 동의해요').check();
  await page.getByLabel('[선택] 이 가족에게 건강정보 제공에 동의해요').check();
  await page.getByRole('button',{name:'동의하고 가족에게 공유'}).click();
  await expect.poll(() => state.linked).toBe(true);
});

test('검진 방문 기록은 저장 실패 후 날짜를 유지하고 수정·삭제한다', async ({ page }, testInfo) => {
  const state = await fixture(page); await login(page);
  await page.getByRole('button', { name: '알겠어요' }).click();
  await page.getByRole('button', { name: '검진', exact: true }).click();
  await page.getByRole('button', { name: '오늘 검진 받았어요 ✓', exact: true }).click();
  await expect(page.getByRole('button', { name: '오늘 검진을 기록했어요 ✓', exact: true })).toBeDisabled();
  expect(state.visits).toHaveLength(1);
  await page.getByRole('button', { name: /일 수정$/ }).click();
  await page.getByLabel('실제 검진 받은 날짜').fill('2026-01-10');
  state.failSave = true;
  await page.getByRole('button', { name: '검진 기록 수정 저장' }).click();
  await expect(page.getByRole('alert')).toContainText('연결');
  await expect(page.getByLabel('실제 검진 받은 날짜')).toHaveValue('2026-01-10');
  state.failSave = false;
  await page.getByRole('button', { name: '검진 기록 수정 저장' }).click();
  await expect(page.getByText('검진 날짜를 수정했어요.', { exact: true })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('visit-history.png'), fullPage: true });
  await page.getByRole('button', { name: '2026년 1월 10일 삭제', exact: true }).click();
  expect(state.visits).toHaveLength(1);
  await page.getByRole('button', { name: '이 검진 기록 삭제', exact: true }).click();
  await expect(page.getByText('아직 검진 기록이 없어요.')).toBeVisible();
  expect(state.visits).toHaveLength(0);
});

test('보호자 빈 리포트는 미실천이나 첫 주로 단정하지 않는다', async ({ page }, testInfo) => {
  const state = await fixture(page, 'A2'); state.linked = true; await login(page);
  await page.getByRole('button', { name: '리포트', exact: true }).click();
  await expect(page.getByRole('heading', { name: '지난 7일 완료 기록률' })).toBeVisible();
  await expect(page.getByText('비교할 기록이 충분하지 않아요')).toBeVisible();
  await expect(page.getByRole('list', { name: '지난 7일 가족 관리 기록' }).getByRole('listitem')).toHaveCount(7);
  await expect(page.getByText(/첫 주 기록|회 놓침|모든 시간을 잘 지키고/)).toHaveCount(0);
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('guardian-report.png'), fullPage: true });
});

test('취소·만료된 요청은 다시 입력할 수 있고 새 요청 후 입력창을 감춘다', async ({ page }) => {
  const state = await fixture(page, 'A2'); state.requestStatus = 'pending'; await login(page);
  await expect(page.getByRole('heading', { name: '승인을 기다리고 있어요' })).toBeVisible();
  await page.getByRole('button', { name: '연결 요청 취소', exact: true }).click();
  await expect(page.getByLabel('초대코드 (6자리)')).toBeVisible();
  state.requestStatus = 'expired';
  await page.getByRole('button', { name: '승인 여부 확인 · 가족 현황 보기' }).click();
  await expect(page.getByText(/24시간이 지나 요청이 만료됐어요/)).toBeVisible();
  await page.getByLabel('초대코드 (6자리)').fill('TEST01');
  await page.getByLabel('초대코드 사용자에게 내 이름·관계 제공에 동의해요').check();
  await page.getByRole('button', { name: '연결 요청하기', exact: true }).click();
  await expect(page.getByText(/사용자 승인 대기 중/)).toBeVisible();
  await expect(page.getByLabel('초대코드 (6자리)')).toHaveCount(0);
});

test('첫 화면은 본인 가입과 보호자 경로를 구분하고 도움말을 제공한다', async ({ page }, testInfo) => {
  await fixture(page); await page.goto('/');
  await page.getByText('보호자는 회원가입을 해야 하나요?', { exact: true }).click();
  await expect(page.getByText(/카카오톡은 코드를 전달하는 방법/)).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('welcome-help.png'), fullPage: true });
  await page.getByRole('button', { name: '틀니 사용자로 회원가입' }).click();
  await expect(page.getByRole('heading', { name: '틀니 사용자 회원가입' })).toBeVisible();
  await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }); window.dispatchEvent(new Event('offline')); });
  await expect(page.getByRole('status').filter({hasText:'인터넷이 연결되지 않았어요'})).toContainText('인터넷이 연결되지 않았어요');
});

test('가입은 필수 동의를 요구하고 건강정보 동의를 선택하지 않아도 계정을 만든다',async({page},testInfo)=>{
 const state=await fixture(page);await page.goto('/');await page.getByRole('button',{name:'틀니 사용자로 회원가입'}).click();
 await page.getByLabel('이름',{exact:true}).fill('시험 사용자');await page.getByLabel('이메일').fill('test@example.invalid');await page.getByLabel('비밀번호',{exact:true}).fill('fixture-password');
 await expect(page.getByRole('button',{name:'가입하기',exact:true})).toBeDisabled();
 await expect(page.getByRole('checkbox')).toHaveCount(4);
 for(const label of ['만 14세 이상이에요','[필수] 개인정보 수집·이용에 동의해요','[필수] 개인정보 국외 이전에 동의해요'])await page.getByLabel(label).check();
 await expect(page.getByLabel('[선택] 건강정보(민감정보) 처리에 동의해요')).not.toBeChecked();
 await noOverflow(page);await page.screenshot({path:testInfo.outputPath('signup-privacy.png'),fullPage:true});
 await page.getByRole('button',{name:'가입하기',exact:true}).click();
 await expect(page.getByRole('heading',{name:'개인정보 안내를 확인해주세요'})).toBeVisible();expect(state.signupCalls).toBe(1);
 expect(state.privacyChoices).toMatchObject({personal:true,sensitive:false,overseas:true,age14:true,version:privacyNotice.version});
 await expect(page.getByRole('button',{name:'동의 내역·권리 요청 확인'})).toBeVisible();
});
test('안내 미게시 시 신규 가입을 막고 기존 사용자는 개인정보 권리를 행사할 수 있다',async({page})=>{
 const state=await fixture(page);state.notice=false;state.consent=false;await page.goto('/');
 await page.getByRole('button',{name:'틀니 사용자로 회원가입'}).click();await expect(page.getByText('개인정보 안내를 준비 중이에요. 준비가 끝나면 가입할 수 있어요.')).toBeVisible();
 await expect(page.getByRole('button',{name:'가입하기',exact:true})).toBeDisabled();expect(state.signupCalls).toBe(0);
 await login(page);await expect(page.getByRole('heading',{name:'개인정보 안내를 확인해주세요'})).toBeVisible();
 await page.getByRole('button',{name:'동의 내역·권리 요청 확인'}).click();await page.getByRole('button',{name:'개인정보 열람 요청',exact:true}).click();
 await expect(page.getByText('개인정보 열람 요청을 접수했어요.')).toBeVisible();expect(state.privacyRequests).toHaveLength(1);await noOverflow(page);
});
test('건강정보 철회는 재확인 후 실행하며 관리 화면을 닫는다',async({page},testInfo)=>{
 const state=await fixture(page);await login(page);await page.getByRole('button',{name:'알겠어요'}).click();await page.getByRole('button',{name:'설정',exact:true}).click();
 await page.getByRole('button',{name:'건강정보 삭제·동의 철회',exact:true}).click();expect(state.health).toBe(true);
 await page.getByRole('button',{name:'건강정보 삭제하고 철회하기',exact:true}).click();
 await expect(page.getByRole('heading',{name:'개인정보 안내를 확인해주세요'})).toBeVisible();expect(state.health).toBe(false);
 await expect(page.getByRole('button',{name:'회원 탈퇴',exact:true})).toBeVisible();await noOverflow(page);await page.screenshot({path:testInfo.outputPath('privacy-withdrawn.png'),fullPage:true});
});
