-- 008: apply AFTER 007 in a test project first. Publish an operator-verified notice
-- in the SAME rollout before opening registration. No historical consent is invented.
begin;
create table if not exists public.privacy_notices (
  version text primary key, document jsonb not null,
  active boolean not null default false, created_at timestamptz not null default now()
);
create unique index if not exists one_active_privacy_notice on public.privacy_notices(active) where active;
create table if not exists public.privacy_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  version text not null references public.privacy_notices(version),
  sensitive boolean not null, accepted_at timestamptz not null default now()
);
create table if not exists public.privacy_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  version text not null references public.privacy_notices(version),
  action text not null, choices jsonb not null, recorded_at timestamptz not null default now()
);
create table if not exists public.sharing_consents (
  link_id uuid primary key references public.care_links(id) on delete cascade,
  version text not null references public.privacy_notices(version),
  accepted_at timestamptz not null default now(), withdrawn_at timestamptz
);
create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check(kind in ('access','correction','deletion','suspension')),
  status text not null default 'received' check(status in ('received','processing','completed','refused')),
  response text, created_at timestamptz not null default now(), responded_at timestamptz
);
do $$ declare t text; begin
  foreach t in array array['privacy_notices','privacy_state','privacy_events','sharing_consents','privacy_requests'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
  end loop;
end $$;
-- Published versions are immutable evidence. Make a new version to change wording.
create or replace function public.protect_privacy_notice() returns trigger
language plpgsql set search_path = '' as $$
declare k text; field text; transfer jsonb;
begin
  if tg_op = 'UPDATE' and (new.document is distinct from old.document or new.version is distinct from old.version) then
    raise exception 'PRIVACY_VERSION_IMMUTABLE';
  end if;
  if new.active and (coalesce((new.document->>'reviewed')::boolean,false) is not true
    or coalesce(length(new.document->>'operator'),0) < 2
    or coalesce(length(new.document->>'contact'),0) < 5
    or coalesce(length(new.document->>'policyUrl'),0) < 10) then
    raise exception 'PRIVACY_NOTICE_INCOMPLETE';
  end if;
  if new.active then
    foreach k in array array['operator','officer','contact','effectiveDate','policyUrl','destruction','safeguards','processors','localStorage','rights'] loop
      if jsonb_typeof(new.document->k) is distinct from 'string' or length(trim(new.document->>k))=0 then raise exception 'PRIVACY_NOTICE_INCOMPLETE'; end if;
    end loop;
    foreach k in array array['account','guardian','health','overseas','family','familyHealth','guardianShare'] loop
      foreach field in array array['purpose','items','retention','refusal'] loop
        if jsonb_typeof(new.document->k->field) is distinct from 'string' or length(trim(new.document->k->>field))=0 then raise exception 'PRIVACY_NOTICE_INCOMPLETE'; end if;
      end loop;
    end loop;
    if jsonb_typeof(new.document->'transfers') is distinct from 'array' then raise exception 'PRIVACY_NOTICE_INCOMPLETE'; end if;
    if jsonb_array_length(new.document->'transfers')=0 then raise exception 'PRIVACY_NOTICE_INCOMPLETE'; end if;
    for transfer in select value from jsonb_array_elements(new.document->'transfers') loop
      foreach k in array array['recipient','contact','countries','items','purpose','timingMethod','retention','refusal'] loop
        if jsonb_typeof(transfer->k) is distinct from 'string' or length(trim(transfer->>k))=0 then raise exception 'PRIVACY_NOTICE_INCOMPLETE'; end if;
      end loop;
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists protect_privacy_notice on public.privacy_notices;
create trigger protect_privacy_notice before insert or update on public.privacy_notices
for each row execute function public.protect_privacy_notice();

create or replace function public.get_privacy_notice() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('version',version,'document',document) from public.privacy_notices where active;
$$;
create or replace function public.private_has_processing_consent(owner uuid, health boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.privacy_state s join public.privacy_notices n on n.version=s.version
    join public.profiles p on p.id=s.user_id
    where s.user_id=owner and n.active and (not health or (s.sensitive and p.role='A1')));
$$;
-- Exposed predicate discloses only the caller's own status; internal cross-account
-- checks stay private to SECURITY DEFINER routines.
create or replace function public.has_processing_consent(owner uuid,health boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(owner=auth.uid(),false) and public.private_has_processing_consent(owner,health);
$$;
create or replace function public.get_privacy_status() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('personal',public.private_has_processing_consent(auth.uid()),
    'sensitive',public.private_has_processing_consent(auth.uid(),true));
$$;
-- Private helper; metadata never constitutes authorization after this server receipt.
create or replace function public.record_privacy_consent(owner uuid, choices jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v text; health boolean; role_name text;
begin
  select version into v from public.privacy_notices where active;
  if v is null then raise exception 'PRIVACY_NOTICE_UNAVAILABLE'; end if;
  if choices->>'version' is distinct from v or choices->'age14' is distinct from 'true'::jsonb
    or choices->'personal' is distinct from 'true'::jsonb or choices->'overseas' is distinct from 'true'::jsonb then
    raise exception 'PRIVACY_CONSENT_REQUIRED';
  end if;
  select role into role_name from public.profiles where id=owner for update;
  if not found then raise exception 'AUTH_REQUIRED'; end if;
  health := role_name='A1' and choices->'sensitive' = 'true'::jsonb;
  health := coalesce(health,false);
  if exists(select 1 from public.privacy_state where user_id=owner and version=v and sensitive=health) then return; end if;
  -- Declining on a renewal cannot silently retain previously collected health records.
  if not health and exists(select 1 from public.privacy_state where user_id=owner and sensitive) then
    raise exception 'USE_HEALTH_WITHDRAWAL';
  end if;
  insert into public.privacy_events(user_id,version,action,choices)
    values(owner,v,'accepted',jsonb_build_object('age14',true,'personal',true,'overseas',true,'sensitive',health));
  insert into public.privacy_state(user_id,version,sensitive) values(owner,v,health)
    on conflict(user_id) do update set version=excluded.version,sensitive=excluded.sensitive,accepted_at=now();
end $$;
create or replace function public.accept_privacy_consent(choices jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public.record_privacy_consent(auth.uid(),choices);
end $$;
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,role,name,invite_code) values(new.id,
    coalesce(new.raw_user_meta_data->>'role','A1'),coalesce(new.raw_user_meta_data->>'name',''),
    upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)));
  perform public.record_privacy_consent(new.id,new.raw_user_meta_data->'privacy');
  return new;
end $$;

-- Full profiles (including invite codes, birth years and phones) are owner-only.
drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles for select using (id=auth.uid());
revoke update on public.profiles from public, anon, authenticated;
grant update(name,font_size_mode) on public.profiles to authenticated;
create or replace function public.is_guardian_of(elder uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.private_has_processing_consent(auth.uid()) and public.private_has_processing_consent(elder,true)
    and exists(select 1 from public.care_links l join public.sharing_consents s on s.link_id=l.id
      join public.privacy_notices n on n.version=s.version
      where l.elder_id=elder and l.guardian_id=auth.uid() and l.status='active' and s.withdrawn_at is null and n.active);
$$;
create or replace function public.get_care_profile(elder uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name',name) from public.profiles where id=elder and public.is_guardian_of(elder);
$$;
create or replace function public.list_my_care_links()
returns table(link_id uuid,other_name text,relation text,linked_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id,case when c.elder_id=auth.uid() or public.is_guardian_of(c.elder_id) then p.name else '개인정보 공유 동의 대기' end,c.relation,c.linked_at
  from public.care_links c join public.profiles p on p.id=case when c.elder_id=auth.uid() then c.guardian_id else c.elder_id end
  where (c.elder_id=auth.uid() or c.guardian_id=auth.uid()) and c.status='active' order by c.linked_at desc;
$$;
-- Restrictive policies compose with existing ownership rules, including direct REST access.
do $$ declare t text; begin
  foreach t in array array['dentures','routines','routine_logs','checkups','checkup_schedules'] loop
    execute format('drop policy if exists privacy_required on public.%I',t);
    execute format('create policy privacy_required on public.%I as restrictive for all to authenticated using ((user_id=auth.uid() and public.has_processing_consent(auth.uid(),true)) or public.is_guardian_of(user_id)) with check (user_id=auth.uid() and public.has_processing_consent(auth.uid(),true))',t);
  end loop;
end $$;
drop policy if exists privacy_required on public.alerts;
create policy privacy_required on public.alerts as restrictive for all to authenticated
using ((elder_id=auth.uid() and public.has_processing_consent(auth.uid(),true)) or public.is_guardian_of(elder_id))
with check ((elder_id=auth.uid() and public.has_processing_consent(auth.uid(),true)) or public.is_guardian_of(elder_id));

-- Serialize health writes with withdrawal: a concurrent request cannot recreate
-- records after deletion using an old consent snapshot.
create or replace function public.guard_health_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare owner uuid;
begin
  if auth.uid() is null then return new; end if;
  owner := case when tg_table_name='alerts' then (to_jsonb(new)->>'elder_id')::uuid else (to_jsonb(new)->>'user_id')::uuid end;
  perform 1 from public.profiles where id=owner for update;
  if not public.private_has_processing_consent(owner,true) then raise exception 'PRIVACY_CONSENT_REQUIRED'; end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['dentures','routines','routine_logs','checkups','checkup_schedules','alerts'] loop
    execute format('drop trigger if exists guard_health_write on public.%I',t);
    execute format('create trigger guard_health_write before insert or update on public.%I for each row execute function public.guard_health_write()',t);
  end loop;
end $$;
-- Use the previous checked implementation privately; old approval routes cannot bypass consent.
do $$ begin
  if to_regprocedure('public.private_resolve_request(uuid,boolean)') is null then
    alter function public.resolve_guardian_request(uuid,boolean) rename to private_resolve_request;
    alter function public.link_with_invite_code(text,text) rename to private_request_connection;
    alter function public.save_checkup_visit(date,uuid,date) rename to private_save_visit;
  end if;
end $$;
create or replace function public.resolve_guardian_request(request_id uuid, accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if accept is distinct from false then raise exception 'SHARING_CONSENT_REQUIRED'; end if;
  perform public.private_resolve_request(request_id,false);
end $$;
create or replace function public.link_with_invite_code(code text,rel text) returns uuid
language plpgsql security definer set search_path = '' as $$
begin raise exception 'SHARING_CONSENT_REQUIRED'; end $$;
create or replace function public.request_guardian_connection(code text,rel text) returns uuid
language plpgsql security definer set search_path = '' as $$
begin raise exception 'SHARING_CONSENT_REQUIRED'; end $$;
create or replace function public.request_guardian_with_consent(code text,rel text,notice_version text,share boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid; v text;
begin
  select version into v from public.privacy_notices where active;
  if not public.private_has_processing_consent(auth.uid()) then raise exception 'PRIVACY_CONSENT_REQUIRED'; end if;
  if share is distinct from true or notice_version is distinct from v then raise exception 'SHARING_CONSENT_REQUIRED'; end if;
  result := public.private_request_connection(code,rel);
  if not exists(select 1 from public.privacy_events where user_id=auth.uid() and action='guardian_request' and choices->>'request_id'=result::text) then
    insert into public.privacy_events(user_id,version,action,choices) values(auth.uid(),v,'guardian_request',
      jsonb_build_object('request_id',result,'recipient_id',(select elder_id from public.guardian_requests where id=result),'recipient','입력한 초대코드의 틀니 사용자','personal_share',true));
  end if;
  return result;
end $$;
create or replace function public.approve_guardian_with_consent(request_id uuid,notice_version text,personal_share boolean,sensitive_share boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare l public.care_links; v text; g uuid;
begin
  perform 1 from public.profiles where id=auth.uid() for update;
  select version into v from public.privacy_notices where active;
  if not public.private_has_processing_consent(auth.uid(),true) then raise exception 'PRIVACY_CONSENT_REQUIRED'; end if;
  if personal_share is distinct from true or sensitive_share is distinct from true or notice_version is distinct from v then raise exception 'SHARING_CONSENT_REQUIRED'; end if;
  select guardian_id into g from public.guardian_requests where id=request_id and elder_id=auth.uid();
  if not public.private_has_processing_consent(g) then raise exception 'GUARDIAN_PRIVACY_REQUIRED'; end if;
  if not exists(select 1 from public.privacy_events where user_id=g and action='guardian_request' and choices->>'request_id'=request_id::text and version=v) then raise exception 'GUARDIAN_SHARING_REQUIRED'; end if;
  perform public.private_resolve_request(request_id,true);
  select * into l from public.care_links where elder_id=auth.uid() and guardian_id=g and status='active';
  insert into public.sharing_consents(link_id,version) values(l.id,v)
    on conflict(link_id) do update set version=excluded.version,accepted_at=now(),withdrawn_at=null;
  insert into public.privacy_events(user_id,version,action,choices) values(auth.uid(),v,'family_shared',
    jsonb_build_object('link_id',l.id,'recipient_id',g,'recipient_name',(select name from public.profiles where id=g),'personal_share',true,'sensitive_share',true));
end $$;
create or replace function public.renew_family_consent(link_id uuid,notice_version text,personal_share boolean,sensitive_share boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare l public.care_links; v text;
begin
  perform 1 from public.profiles where id=auth.uid() for update;
  select version into v from public.privacy_notices where active;
  select * into l from public.care_links where id=link_id and elder_id=auth.uid() and status='active' for update;
  if not found then raise exception 'REQUEST_NOT_ALLOWED'; end if;
  if not public.private_has_processing_consent(auth.uid(),true) then raise exception 'PRIVACY_CONSENT_REQUIRED'; end if;
  if personal_share is distinct from true or sensitive_share is distinct from true or notice_version is distinct from v then raise exception 'SHARING_CONSENT_REQUIRED'; end if;
  insert into public.sharing_consents(link_id,version) values(l.id,v)
    on conflict on constraint sharing_consents_pkey do update set version=excluded.version,accepted_at=now(),withdrawn_at=null;
  insert into public.privacy_events(user_id,version,action,choices) values(auth.uid(),v,'family_shared',
    jsonb_build_object('link_id',l.id,'recipient_id',l.guardian_id,'recipient_name',(select name from public.profiles where id=l.guardian_id),'personal_share',true,'sensitive_share',true));
end $$;
create or replace function public.withdraw_family_consent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status='revoked' and old.status='active' then
    insert into public.privacy_events(user_id,version,action,choices)
      select new.elder_id,version,'family_withdrawn',jsonb_build_object('link_id',new.id)
      from public.sharing_consents where link_id=new.id and withdrawn_at is null;
    update public.sharing_consents set withdrawn_at=now() where link_id=new.id;
  end if;
  return new;
end $$;
drop trigger if exists withdraw_family_consent on public.care_links;
create trigger withdraw_family_consent after update of status on public.care_links
for each row execute function public.withdraw_family_consent();
create or replace function public.save_checkup_visit(visit_date date,visit_id uuid default null,previous_date date default null) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.profiles where id=auth.uid() for update;
  if not public.private_has_processing_consent(auth.uid(),true) then raise exception 'PRIVACY_CONSENT_REQUIRED'; end if;
  return public.private_save_visit(visit_date,visit_id,previous_date);
end $$;
-- Rights remain available even when a notice changes or the member declines health processing.
create or replace function public.withdraw_health_consent() returns void
language plpgsql security definer set search_path = '' as $$
declare owner uuid := auth.uid(); v text;
begin
  if owner is null then raise exception 'AUTH_REQUIRED'; end if;
  perform 1 from public.profiles where id=owner for update;
  select version into v from public.privacy_state where user_id=owner;
  update public.care_links set status='revoked' where elder_id=owner and status='active';
  delete from public.guardian_requests where elder_id=owner;
  delete from public.alerts where elder_id=owner;
  delete from public.checkup_schedules where user_id=owner;
  delete from public.checkups where user_id=owner;
  delete from public.routine_logs where user_id=owner;
  delete from public.routines where user_id=owner;
  delete from public.dentures where user_id=owner;
  update public.privacy_state set sensitive=false where user_id=owner;
  if v is not null then
    insert into public.privacy_events(user_id,version,action,choices) values(owner,v,'health_withdrawn','{"sensitive":false}');
  end if;
end $$;
create or replace function public.clear_legacy_profile_fields() returns void
language sql security definer set search_path = '' as $$
  update public.profiles set birth_year=null,phone=null where id=auth.uid();
$$;
create or replace function public.list_privacy_events() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(e) order by e.recorded_at desc),'[]'::jsonb) from
    (select id,version,action,choices,recorded_at from public.privacy_events where user_id=auth.uid()) e;
$$;
create or replace function public.get_accepted_notice(notice_version text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select document from public.privacy_notices where version=notice_version and exists(
    select 1 from public.privacy_events where user_id=auth.uid() and version=notice_version);
$$;
create or replace function public.submit_privacy_request(request_kind text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  perform 1 from public.profiles where id=auth.uid() for update;
  select id into result from public.privacy_requests where user_id=auth.uid() and kind=request_kind and status in ('received','processing') limit 1;
  if result is not null then return result; end if;
  insert into public.privacy_requests(user_id,kind) values(auth.uid(),request_kind) returning id into result;
  return result;
end $$;
create or replace function public.list_privacy_requests() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc),'[]'::jsonb) from
    (select id,kind,status,response,created_at,responded_at from public.privacy_requests where user_id=auth.uid()) r;
$$;
create or replace function public.count_sharing_guardians() returns bigint
language sql stable security definer set search_path = '' as $$
  select count(*) from public.care_links l join public.sharing_consents s on s.link_id=l.id
    join public.privacy_notices n on n.version=s.version
    where l.elder_id=auth.uid() and l.status='active' and s.withdrawn_at is null and n.active
      and public.private_has_processing_consent(auth.uid(),true) and public.private_has_processing_consent(l.guardian_id);
$$;
-- Only operational cron/service roles may run this job; no processing before consent.
create or replace function public.flag_missed_routines() returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.alerts(elder_id,type,detail)
  select p.id,'missed','오늘 관리 기록이 적어요. 가족에게 안부를 확인해주세요.' from public.profiles p
  where p.role='A1' and public.private_has_processing_consent(p.id,true)
    and exists(select 1 from public.care_links l join public.sharing_consents s on s.link_id=l.id
      join public.privacy_notices n on n.version=s.version
      where l.elder_id=p.id and l.status='active' and s.withdrawn_at is null and n.active
        and public.private_has_processing_consent(l.guardian_id))
    and exists(select 1 from public.routines where user_id=p.id and enabled)
    and (select count(*) from public.routine_logs where user_id=p.id and log_date=(now() at time zone 'Asia/Seoul')::date)<3
    and not exists(select 1 from public.alerts where elder_id=p.id and type='missed' and (created_at at time zone 'Asia/Seoul')::date=(now() at time zone 'Asia/Seoul')::date);
end $$;
-- Explicit privilege surface; helpers and triggers cannot be called by app users.
revoke all on function public.private_has_processing_consent(uuid,boolean),public.record_privacy_consent(uuid,jsonb),public.handle_new_user(),public.protect_privacy_notice(),
  public.private_resolve_request(uuid,boolean),public.private_request_connection(text,text),public.private_save_visit(date,uuid,date),
  public.withdraw_family_consent(),public.guard_health_write(),public.flag_missed_routines() from public,anon,authenticated;
do $$ declare f text; begin
  foreach f in array array['get_privacy_status()','accept_privacy_consent(jsonb)','get_care_profile(uuid)',
    'request_guardian_with_consent(text,text,text,boolean)','approve_guardian_with_consent(uuid,text,boolean,boolean)',
    'renew_family_consent(uuid,text,boolean,boolean)','withdraw_health_consent()','clear_legacy_profile_fields()',
    'list_privacy_events()','get_accepted_notice(text)','submit_privacy_request(text)','list_privacy_requests()',
    'count_sharing_guardians()','has_processing_consent(uuid,boolean)','is_guardian_of(uuid)','save_checkup_visit(date,uuid,date)','resolve_guardian_request(uuid,boolean)','link_with_invite_code(text,text)'] loop
    execute 'revoke all on function public.'||f||' from public,anon';
    execute 'grant execute on function public.'||f||' to authenticated';
  end loop;
end $$;
revoke all on function public.get_privacy_notice() from public;
grant execute on function public.get_privacy_notice() to anon,authenticated;
commit;
