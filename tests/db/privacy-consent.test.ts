import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll,beforeAll,beforeEach,expect,it } from 'vitest';
import notice from '../fixtures/privacy-notice.json';
const elder='00000000-0000-4000-8000-000000000001',guardian='00000000-0000-4000-8000-000000000002',stranger='00000000-0000-4000-8000-000000000003';
let pg:PGlite;
const choices=(health=true)=>({version:notice.version,age14:true,personal:true,sensitive:health,overseas:true});
async function user(id:string,sql:string,params:unknown[]=[]){return pg.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);return tx.query(sql,params);});}
async function create(id:string,role='A1',privacy:unknown=choices()) {return pg.query('insert into auth.users values($1,$2)',[id,JSON.stringify({role,name:role==='A1'?'시험 사용자':'시험 가족',privacy})]);}
beforeAll(async()=>{
 pg=new PGlite();await pg.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb not null default '{}');create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to anon,authenticated;`);
 await pg.exec(readFileSync('db/migrations/001_init.sql','utf8').replace('alter publication supabase_realtime add table public.alerts;',''));
 await pg.exec('grant all on all tables in schema public to anon,authenticated;');
 for(const file of ['003_undo_check','004_account_safety','005_checkup_schedule','006_guardian_approval','007_request_and_visit_integrity','008_privacy_consent']) await pg.exec(readFileSync(`db/migrations/${file}.sql`,'utf8'));
 await pg.exec(readFileSync('db/migrations/008_privacy_consent.sql','utf8'));
 await pg.query('insert into public.privacy_notices(version,document,active) values($1,$2,true)',[notice.version,JSON.stringify(notice.document)]);
});
beforeEach(async()=>{await pg.exec('truncate auth.users cascade');await pg.exec('update public.privacy_notices set active=false');await pg.query('update public.privacy_notices set active=true where version=$1',[notice.version]);await create(elder);await create(guardian,'A2');await create(stranger);await pg.query("update public.profiles set invite_code='ELDER1' where id=$1",[elder]);});
afterAll(async()=>{await pg?.close();});
async function request(){return (await user(guardian,"select public.request_guardian_with_consent('ELDER1','어머니',$1,true) as id",[notice.version])).rows[0].id;}
async function approve(id:unknown){return user(elder,'select public.approve_guardian_with_consent($1,$2,true,true)',[id,notice.version]);}
it('서버는 체크 누락·거절·오래된 버전·미게시 안내로 가입을 허용하지 않는다',async()=>{
 const id='00000000-0000-4000-8000-000000000004';
 for(const p of [null,{}, {...choices(),age14:false},{...choices(),personal:null},{...choices(),overseas:false},{...choices(),version:'old'}])await expect(create(id,'A1',p)).rejects.toThrow(/PRIVACY_CONSENT_REQUIRED/);
 await pg.exec('update public.privacy_notices set active=false');await expect(create(id)).rejects.toThrow(/PRIVACY_NOTICE_UNAVAILABLE/);
 expect((await pg.query('select * from public.profiles where id=$1',[id])).rows).toHaveLength(0);
});
it('서버 시간·문서 버전을 기록하고 같은 동의 재시도는 중복 기록하지 않는다',async()=>{
 await user(elder,'select public.accept_privacy_consent($1)',[JSON.stringify(choices())]);
 const events=(await user(elder,'select public.list_privacy_events() as events')).rows[0].events as any[];
 expect(events).toHaveLength(1);expect(events[0]).toMatchObject({version:notice.version,action:'accepted',choices:{sensitive:true}});expect(events[0].recorded_at).toBeTruthy();
 await expect(user(elder,"update public.privacy_state set sensitive=false")).rejects.toThrow(/permission denied/);
 await expect(user(elder,'select public.record_privacy_consent($1,$2)',[stranger,JSON.stringify(choices())])).rejects.toThrow(/permission denied/);
});
it('건강정보 미동의 계정은 생성할 수 있으나 직접 저장과 방문 RPC 모두 차단한다',async()=>{
 const id='00000000-0000-4000-8000-000000000004';await create(id,'A1',choices(false));
 expect((await user(id,'select public.get_privacy_status() as s')).rows[0].s).toEqual({personal:true,sensitive:false});
 await expect(user(id,"insert into public.routines(user_id,slot,alarm_time,label) values(auth.uid(),'A00','07:00','기상')")).rejects.toThrow(/row-level security|PRIVACY_CONSENT_REQUIRED/);
 await expect(user(id,"select public.save_checkup_visit(current_date)")).rejects.toThrow(/PRIVACY_CONSENT_REQUIRED/);
});
it('구버전 연결·승인 RPC와 별도 공유 동의 누락은 우회할 수 없다',async()=>{
 await expect(user(guardian,"select public.request_guardian_connection('ELDER1','어머니')")).rejects.toThrow(/SHARING_CONSENT_REQUIRED/);
 await expect(user(guardian,"select public.link_with_invite_code('ELDER1','어머니')")).rejects.toThrow(/SHARING_CONSENT_REQUIRED/);
 await expect(user(guardian,"select public.request_guardian_with_consent('ELDER1','어머니',$1,false)",[notice.version])).rejects.toThrow(/SHARING_CONSENT_REQUIRED/);
 const id=await request();await expect(user(elder,'select public.resolve_guardian_request($1,true)',[id])).rejects.toThrow(/SHARING_CONSENT_REQUIRED/);
 await expect(user(elder,'select public.approve_guardian_with_consent($1,$2,true,null)',[id,notice.version])).rejects.toThrow(/SHARING_CONSENT_REQUIRED/);
 expect((await pg.query('select * from public.care_links')).rows).toHaveLength(0);
});
it('가족은 별도 동의 이후에만 기록과 이름을 읽고 프로필·초대코드는 읽지 못한다',async()=>{
 await user(elder,"insert into public.routine_logs(user_id,slot) values(auth.uid(),'A00')");const id=await request();
 expect((await user(guardian,'select * from public.routine_logs')).rows).toHaveLength(0);
 await approve(id);expect((await user(guardian,'select * from public.routine_logs')).rows).toHaveLength(1);
 expect((await user(guardian,'select public.get_care_profile($1) as p',[elder])).rows[0].p).toEqual({name:'시험 사용자'});
 expect((await user(guardian,'select * from public.profiles where id=$1',[elder])).rows).toHaveLength(0);
 expect((await user(stranger,'select public.get_care_profile($1) as p',[elder])).rows[0].p).toBeNull();
 await expect(user(guardian,'update public.profiles set role=\'A1\' where id=auth.uid()')).rejects.toThrow(/permission denied/);
 await expect(user(guardian,"insert into public.routine_logs(user_id,slot) values($1,'A01')",[elder])).rejects.toThrow(/row-level security|PRIVACY_CONSENT_REQUIRED/);
});
it('기존 연결을 동의로 간주하지 않고 소유자가 공유 동의를 갱신할 수 있다',async()=>{
 const link=(await pg.query("insert into public.care_links(elder_id,guardian_id) values($1,$2) returning id",[elder,guardian])).rows[0].id;
 expect((await user(guardian,'select public.is_guardian_of($1) as yes',[elder])).rows[0].yes).toBe(false);
 await user(elder,'select public.renew_family_consent($1,$2,true,true)',[link,notice.version]);
 expect((await user(guardian,'select public.is_guardian_of($1) as yes',[elder])).rows[0].yes).toBe(true);
 await user(guardian,"update public.care_links set status='revoked' where id=$1",[link]);
 expect((await user(guardian,'select public.is_guardian_of($1) as yes',[elder])).rows[0].yes).toBe(false);
 await expect(user(elder,'select public.renew_family_consent($1,$2,true,true)',[link,notice.version])).rejects.toThrow(/REQUEST_NOT_ALLOWED/);
});
it('건강정보 철회는 본인 건강 기록·공유만 삭제하고 계정과 다른 사용자 기록은 보존한다',async()=>{
 await approve(await request());
 for(const id of [elder,stranger]){await user(id,"insert into public.dentures(user_id,made_year,made_month) values(auth.uid(),2020,3)");await user(id,"select public.save_checkup_visit(current_date)");}
 await user(elder,'select public.withdraw_health_consent()');
 expect((await pg.query('select user_id from public.dentures')).rows).toEqual([{user_id:stranger}]);
 expect((await pg.query('select user_id from public.checkups')).rows).toEqual([{user_id:stranger}]);
 expect((await pg.query('select * from public.profiles')).rows).toHaveLength(3);
 expect((await user(elder,'select public.get_privacy_status() as s')).rows[0].s).toEqual({personal:true,sensitive:false});
 expect((await user(guardian,'select public.is_guardian_of($1) as yes',[elder])).rows[0].yes).toBe(false);
});
it('새 안내문 게시 시 갱신 전 건강정보 접근과 신규 처리를 차단한다',async()=>{
 await user(elder,"insert into public.routine_logs(user_id,slot) values(auth.uid(),'A00')");await approve(await request());
 await pg.exec('update public.privacy_notices set active=false');await pg.query('insert into public.privacy_notices values($1,$2,true) on conflict(version) do update set active=true',[notice.version+'.next',JSON.stringify(notice.document)]);
 expect((await user(elder,'select * from public.routine_logs')).rows).toHaveLength(0);expect((await user(guardian,'select * from public.routine_logs')).rows).toHaveLength(0);
 await expect(user(elder,'select public.save_checkup_visit(current_date)')).rejects.toThrow(/PRIVACY_CONSENT_REQUIRED/);
});
it('동의·권리행사 이력은 본인만 조회하며 요청 재시도는 중복 생성하지 않는다',async()=>{
 const a=await user(elder,"select public.submit_privacy_request('access') as id"),b=await user(elder,"select public.submit_privacy_request('access') as id");expect(a.rows).toEqual(b.rows);
 expect((await user(stranger,'select public.list_privacy_requests() as r')).rows[0].r).toEqual([]);
 expect((await user(elder,'select public.list_privacy_requests() as r')).rows[0].r).toHaveLength(1);
 await expect(user(elder,"update public.privacy_requests set status='completed'")).rejects.toThrow(/permission denied/);
});
it('전체 탈퇴는 개인정보 상태·동의·권리요청을 함께 삭제한다',async()=>{
 await user(elder,"select public.submit_privacy_request('deletion')");await user(elder,'select public.delete_own_account()');
 for(const t of ['privacy_state','privacy_events','privacy_requests'])expect((await pg.query(`select * from public.${t} where user_id=$1`,[elder])).rows).toHaveLength(0);
});
it('게시한 문서는 덮어쓸 수 없고 이전 버전은 동의 당사자만 열람한다',async()=>{
 await expect(pg.query("update public.privacy_notices set document='{}' where version=$1",[notice.version])).rejects.toThrow(/PRIVACY_VERSION_IMMUTABLE/);
 expect((await user(elder,'select public.get_accepted_notice($1) as d',[notice.version])).rows[0].d).toEqual(notice.document);
 expect((await user(elder,"select public.get_accepted_notice('unknown') as d")).rows[0].d).toBeNull();
});
it('누락된 고지 문서는 게시할 수 없다',async()=>{
 await pg.exec('update public.privacy_notices set active=false');
 const d={...notice.document,transfers:[]};
 await expect(pg.query('insert into public.privacy_notices(version,document,active) values($1,$2,true)',['incomplete',JSON.stringify(d)])).rejects.toThrow(/PRIVACY_NOTICE_INCOMPLETE/);
});
it('서버 예약 작업은 일반 사용자가 호출하지 못하고 동의한 가족만 집계한다',async()=>{
 expect((await user(elder,'select public.count_sharing_guardians() as count')).rows[0].count).toBe(0);
 await approve(await request());expect((await user(elder,'select public.count_sharing_guardians() as count')).rows[0].count).toBe(1);
 await user(guardian,"update public.care_links set status='revoked'");expect((await user(elder,'select public.count_sharing_guardians() as count')).rows[0].count).toBe(0);
 await expect(user(elder,'select public.flag_missed_routines()')).rejects.toThrow(/permission denied/);
});

it('다른 사용자의 건강정보 동의 상태를 공개 함수로 탐색할 수 없다',async()=>{
 expect((await user(stranger,'select public.has_processing_consent($1,true) as allowed',[elder])).rows[0].allowed).toBe(false);
 await expect(user(stranger,'select public.private_has_processing_consent($1,true)',[elder])).rejects.toThrow(/permission denied/);
});
