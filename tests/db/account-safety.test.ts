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

describe('실제 SQL 정책과 본인 탈퇴', () => {
  it('연결된 보호자만 읽으며, 다른 사람 기록은 보이지 않는다', async () => {
    expect((await asUser(guardian, 'select * from public.routines')).rows).toHaveLength(0);
    await link();
    expect((await asUser(guardian, 'select * from public.routines')).rows).toHaveLength(1);
    expect((await asUser(guardian, 'select * from public.list_my_care_links()')).rows[0]).toMatchObject({ other_name: '시험 사용자' });
  });
  it('잘못된 코드는 연결을 만들지 않고 같은 코드 재시도는 중복 연결을 만들지 않는다', async () => {
    await expect(asUser(guardian, "select public.link_with_invite_code('BAD000', '어머니')")).rejects.toThrow(/INVALID_CODE/);
    expect((await pg.query('select * from public.care_links')).rows).toHaveLength(0);
    await asUser(guardian, "select public.link_with_invite_code(' elder1 ', '어머니')");
    await asUser(guardian, "select public.link_with_invite_code('ELDER1', '아버지')");
    expect((await pg.query('select relation from public.care_links')).rows).toEqual([{ relation: '아버지' }]);
  });
  it('보호자가 연결 대상을 다른 사용자로 바꿀 수 없다', async () => {
    await link();
    await expect(asUser(guardian, `update public.care_links set elder_id = '${stranger}'`)).rejects.toThrow(/permission denied/i);
    expect((await asUser(guardian, `select * from public.routines where user_id = '${stranger}'`)).rows).toHaveLength(0);
  });
  it('보호자는 읽음 표시만 바꾸고 요청 내용과 사용자 기록은 수정하지 못한다', async () => {
    await link();
    await expect(asUser(guardian, "update public.alerts set detail = '변조'" )).rejects.toThrow(/permission denied/i);
    expect((await asUser(guardian, 'update public.alerts set read_at = now() returning id')).rows).toHaveLength(1);
    expect((await asUser(guardian, "update public.routines set alarm_time = '09:00' returning id")).rows).toHaveLength(0);
    expect((await asUser(guardian, 'delete from public.routine_logs returning id')).rows).toHaveLength(0);
  });
  it('연결 해제 즉시 읽기가 차단되고 이전 코드로 다시 연결할 수 없다', async () => {
    await link();
    await asUser(elder, "update public.care_links set status = 'revoked'");
    expect((await asUser(guardian, 'select * from public.routines')).rows).toHaveLength(0);
    await expect(link()).rejects.toThrow(/INVALID_CODE/);
    await expect(asUser(guardian, "update public.care_links set status = 'active'")).rejects.toThrow(/row-level security/);
    const profile = await pg.query<{ invite_code: string }>('select invite_code from public.profiles where id = $1', [elder]);
    expect(profile.rows[0].invite_code).not.toBe('ELDER1');
  });
  it('익명 계정 삭제와 클라이언트의 서버 예약 작업 실행을 차단한다', async () => {
    await expect(pg.transaction(async (tx) => {
      await tx.exec('set local role anon'); return tx.query('select public.delete_own_account()');
    })).rejects.toThrow(/permission denied/i);
    await expect(asUser(guardian, 'select public.flag_missed_routines()')).rejects.toThrow(/permission denied/i);
    await expect(asUser(stranger, "select public.link_with_invite_code('ELDER1', '가족')")).rejects.toThrow(/GUARDIAN_REQUIRED/);
  });
  it('본인 탈퇴는 본인 데이터만 연쇄 삭제하며 다른 계정을 유지한다', async () => {
    await link();
    await pg.query("insert into public.dentures(user_id,made_year,made_month) values ($1,2025,1)", [elder]);
    await pg.query("insert into public.checkups(user_id,visited_on,next_recall_on,interval_months) values ($1,'2026-01-01','2026-07-01',6)", [elder]);
    await asUser(elder, 'select public.delete_own_account()');
    expect((await pg.query('select * from auth.users')).rows).toHaveLength(2);
    for (const table of ['dentures', 'routine_logs', 'checkups', 'care_links', 'alerts']) {
      expect((await pg.query(`select * from public.${table}`)).rows).toHaveLength(0);
    }
    expect((await pg.query('select * from public.routines')).rows).toHaveLength(1);
  });
  it('보호자 탈퇴는 연결만 제거하고 사용자의 기록을 유지한다', async () => {
    await link(); await asUser(guardian, 'select public.delete_own_account()');
    expect((await pg.query('select * from public.care_links')).rows).toHaveLength(0);
    expect((await pg.query('select * from public.routine_logs')).rows).toHaveLength(1);
  });
});
