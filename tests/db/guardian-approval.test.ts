import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const elder = '00000000-0000-4000-8000-000000000001';
const guardian = '00000000-0000-4000-8000-000000000002';
const stranger = '00000000-0000-4000-8000-000000000003';
let pg: PGlite;
// Supabase의 auth.uid와 기본 DB 권한만 재현한다. 외부 서버/실제 계정에 접속하지 않는다.
async function asUser(id: string, sql: string) {
  return pg.transaction(async (tx) => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [id]);
    return tx.query(sql);
  });
}
const link = () => asUser(guardian, "select public.link_with_invite_code('ELDER1', '자녀')");

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key, raw_user_meta_data jsonb not null default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated;
  `);
  const initial = readFileSync('db/migrations/001_init.sql', 'utf8')
    .replace('alter publication supabase_realtime add table public.alerts;', '');
  await pg.exec(initial);
  await pg.exec(`grant all on all tables in schema public to anon, authenticated;
    create function public.flag_missed_routines() returns void language sql as $$ select $$;`);
  await pg.exec(readFileSync('db/migrations/003_undo_check.sql', 'utf8'));
  await pg.exec(readFileSync('db/migrations/004_account_safety.sql', 'utf8'));
  await pg.exec(readFileSync('db/migrations/006_guardian_approval.sql', 'utf8'));
});
beforeEach(async () => {
  await pg.exec('truncate auth.users cascade');
  for (const [id, role, name] of [[elder, 'A1', '시험 사용자'], [guardian, 'A2', '시험 보호자'], [stranger, 'A1', '다른 사용자']]) {
    await pg.query('insert into auth.users values ($1, $2)', [id, JSON.stringify({ role, name })]);
  }
  await pg.query("update public.profiles set invite_code = 'ELDER1' where id = $1", [elder]);
  await pg.query("insert into public.routines(user_id, slot, alarm_time, label) values ($1,'A00','07:00','기상 후'),($2,'A00','07:00','기상 후')", [elder, stranger]);
  await pg.query("insert into public.routine_logs(user_id,slot) values ($1,'A00')", [elder]);
  await pg.query("insert into public.alerts(elder_id,type,detail) values ($1,'emergency','시험 요청')", [elder]);
});
afterAll(async () => { await pg?.close(); });

async function request() {
  const result = await asUser(guardian, "select public.request_guardian_connection('ELDER1','어머니') as id");
  return result.rows[0].id;
}
it('코드만으로는 조회할 수 없고 당사자 승인 후에만 조회한다', async () => {
  const id = await request();
  expect((await asUser(guardian, 'select * from public.routines')).rows).toHaveLength(0);
  expect((await asUser(guardian, 'select * from public.profiles')).rows).toHaveLength(1);
  await expect(asUser(guardian, `select public.resolve_guardian_request('${id}',true)`)).rejects.toThrow(/REQUEST_NOT_ALLOWED/);
  await expect(asUser(stranger, `select public.resolve_guardian_request('${id}',true)`)).rejects.toThrow(/REQUEST_NOT_ALLOWED/);
  await asUser(elder, `select public.resolve_guardian_request('${id}',true)`);
  expect((await asUser(guardian, 'select * from public.routines')).rows).toHaveLength(1);
  await asUser(elder, "update public.care_links set status='revoked'");
  expect((await asUser(guardian, 'select * from public.routines')).rows).toHaveLength(0);
});
it('기존 RPC로 승인을 우회할 수 없으며 직접 요청 테이블 변경도 차단한다', async () => {
  await link();
  expect((await asUser(guardian, 'select * from public.routines')).rows).toHaveLength(0);
  await expect(asUser(guardian, "update public.guardian_requests set status='approved'")).rejects.toThrow(/permission denied/);
});
it('거절·취소·만료 요청은 승인할 수 없다', async () => {
  let id = await request();
  await asUser(elder, `select public.resolve_guardian_request('${id}',false)`);
  await expect(asUser(elder, `select public.resolve_guardian_request('${id}',true)`)).rejects.toThrow(/REQUEST_EXPIRED/);
  id = await request();
  await asUser(guardian, `select public.cancel_guardian_request('${id}')`);
  await expect(asUser(elder, `select public.resolve_guardian_request('${id}',true)`)).rejects.toThrow(/REQUEST_EXPIRED/);
  id = await request();
  await pg.exec("update public.guardian_requests set expires_at=now()-interval '1 second'");
  await expect(asUser(elder, `select public.resolve_guardian_request('${id}',true)`)).rejects.toThrow(/REQUEST_EXPIRED/);
});
it('목록은 본인 요청만 보여주며 승인 전 사용자 이름을 공개하지 않는다', async () => {
  await request();
  expect((await asUser(stranger,'select * from public.list_guardian_requests()')).rows).toHaveLength(0);
  expect((await asUser(guardian,'select * from public.list_guardian_requests()')).rows[0]).toMatchObject({ other_name: '틀니 사용자' });
  expect((await asUser(elder,'select * from public.list_guardian_requests()')).rows[0]).toMatchObject({ other_name: '시험 보호자' });
});
it('중복 요청은 하나만 저장하고 잘못된 코드는 요청을 생성하지 않는다', async () => {
  await expect(asUser(guardian,"select public.request_guardian_connection('BAD000','어머니')")).rejects.toThrow(/INVALID_CODE/);
  expect((await pg.query('select * from public.guardian_requests')).rows).toHaveLength(0);
  await request(); await request();
  expect((await pg.query('select * from public.guardian_requests')).rows).toHaveLength(1);
});
