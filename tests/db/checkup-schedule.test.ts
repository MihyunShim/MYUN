import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const elder = '00000000-0000-4000-8000-000000000011';
const guardian = '00000000-0000-4000-8000-000000000012';
const stranger = '00000000-0000-4000-8000-000000000013';
let pg: PGlite;
async function asUser(id: string, sql: string) {
  return pg.transaction(async (tx) => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [id]);
    return tx.query(sql);
  });
}
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated;`);
  await pg.exec(readFileSync('db/migrations/001_init.sql', 'utf8').replace('alter publication supabase_realtime add table public.alerts;', ''));
  await pg.exec('grant all on all tables in schema public to anon, authenticated');
  await pg.exec(readFileSync('db/migrations/004_account_safety.sql', 'utf8'));
  await pg.exec(readFileSync('db/migrations/005_checkup_schedule.sql', 'utf8'));
  await pg.exec(readFileSync('db/migrations/006_guardian_approval.sql', 'utf8'));
  await pg.exec(readFileSync('db/migrations/007_request_and_visit_integrity.sql', 'utf8'));
});
beforeEach(async () => {
  await pg.exec('truncate auth.users cascade');
  for (const [id, role] of [[elder, 'A1'], [guardian, 'A2'], [stranger, 'A1']]) {
    await pg.query('insert into auth.users values ($1,$2)', [id, JSON.stringify({ role })]);
  }
  await pg.query("insert into public.care_links(elder_id,guardian_id) values ($1,$2)", [elder, guardian]);
});
afterAll(async () => { await pg?.close(); });

describe('검진 일정의 실제 SQL 권한', () => {
  it('검진 방문일을 저장할 때 근거 없는 다음 날짜를 생성하지 않는다', async () => {
    expect((await asUser(elder, `insert into public.checkups(user_id, visited_on) values ('${elder}', '2026-09-11') returning next_recall_on, interval_months`)).rows).toEqual([{ next_recall_on: null, interval_months: null }]);
  });
  it('본인은 새 일정 입력, 날짜 변경, 삭제가 가능하다', async () => {
    await asUser(elder, `insert into public.checkup_schedules values ('${elder}','2026-12-01')`);
    expect((await asUser(elder, "update public.checkup_schedules set scheduled_on='2027-01-03' returning scheduled_on::text")).rows).toEqual([{ scheduled_on: '2027-01-03' }]);
    expect((await asUser(elder, 'delete from public.checkup_schedules returning user_id')).rows).toHaveLength(1);
  });
  it('활성 보호자는 읽기만 가능하고 해제 후 즉시 보이지 않는다', async () => {
    await asUser(elder, `insert into public.checkup_schedules values ('${elder}','2026-12-01')`);
    expect((await asUser(guardian, 'select * from public.checkup_schedules')).rows).toHaveLength(1);
    expect((await asUser(stranger, 'select * from public.checkup_schedules')).rows).toHaveLength(0);
    expect((await asUser(guardian, "update public.checkup_schedules set scheduled_on='2027-01-01' returning user_id")).rows).toHaveLength(0);
    expect((await asUser(guardian, 'delete from public.checkup_schedules returning user_id')).rows).toHaveLength(0);
    await expect(asUser(guardian, `insert into public.checkup_schedules values ('${stranger}','2027-01-01')`)).rejects.toThrow(/row-level security/);
    await asUser(guardian, "update public.care_links set status='revoked'");
    expect((await asUser(guardian, 'select * from public.checkup_schedules')).rows).toHaveLength(0);
  });
  it('익명 접근, 소유자 바꿔치기, 유효하지 않은 날짜를 차단한다', async () => {
    await asUser(elder, `insert into public.checkup_schedules values ('${elder}','2026-12-01')`);
    await expect(asUser(elder, `update public.checkup_schedules set user_id='${stranger}'`)).rejects.toThrow(/row-level security/);
    await expect(asUser(elder, "update public.checkup_schedules set scheduled_on='2027-02-29'")).rejects.toThrow(/date\/time/);
    await expect(asUser(elder, "update public.checkup_schedules set scheduled_on='infinity'")).rejects.toThrow(/check constraint/);
    await expect(pg.transaction(async (tx) => { await tx.exec('set local role anon'); return tx.query('select * from public.checkup_schedules'); })).rejects.toThrow(/permission denied/);
  });
  it('탈퇴 시 일정이 연쇄 삭제되고 다른 사람 일정은 보존된다', async () => {
    await asUser(elder, `insert into public.checkup_schedules values ('${elder}','2026-12-01')`);
    await asUser(stranger, `insert into public.checkup_schedules values ('${stranger}','2026-12-01')`);
    await asUser(elder, 'select public.delete_own_account()');
    expect((await pg.query('select user_id from public.checkup_schedules')).rows).toEqual([{ user_id: stranger }]);
  });
});

it('방문 기록 재시도는 중복 생성하지 않고 수정·삭제는 본인만 한다', async () => {
  const create = () => asUser(elder, "select public.save_checkup_visit('2026-01-10') as id");
  const id = (await create()).rows[0].id;
  expect((await create()).rows[0].id).toBe(id);
  expect((await pg.query('select * from public.checkups')).rows).toHaveLength(1);
  await expect(asUser(guardian, `select public.save_checkup_visit('2026-01-09','${id}','2026-01-10')`)).rejects.toThrow(/VISIT_NOT_ALLOWED/);
  await expect(asUser(stranger, `select public.delete_checkup_visit('${id}','2026-01-10')`)).rejects.toThrow(/VISIT_CHANGED/);
  await asUser(elder, `select public.save_checkup_visit('2026-01-09','${id}','2026-01-10')`);
  await expect(asUser(elder, `select public.delete_checkup_visit('${id}','2026-01-10')`)).rejects.toThrow(/VISIT_CHANGED/);
  await asUser(elder, `select public.delete_checkup_visit('${id}','2026-01-09')`);
  expect((await pg.query('select * from public.checkups')).rows).toHaveLength(0);
});
it('검진 기록은 미래·빈 날짜와 중복 날짜 수정을 거부한다', async () => {
  await expect(asUser(elder, "select public.save_checkup_visit('9999-01-01')")).rejects.toThrow(/INVALID_VISIT_DATE/);
  await expect(asUser(elder, "select public.save_checkup_visit(null)")).rejects.toThrow(/INVALID_VISIT_DATE/);
  const id = (await asUser(elder, "select public.save_checkup_visit('2026-01-10') as id")).rows[0].id;
  await asUser(elder, "select public.save_checkup_visit('2026-01-11')");
  await expect(asUser(elder, `select public.save_checkup_visit('2026-01-11','${id}','2026-01-10')`)).rejects.toThrow(/VISIT_DUPLICATE/);
  await expect(pg.transaction(async tx => { await tx.exec('set local role anon'); return tx.query("select public.save_checkup_visit('2026-01-10')"); })).rejects.toThrow(/permission denied/);
});
