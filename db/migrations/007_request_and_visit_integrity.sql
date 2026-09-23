-- After 006. Re-runnable; preserves existing requests, links and visits.
begin;
create or replace function public.link_with_invite_code(code text, rel text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare elder uuid; requester uuid := auth.uid(); result uuid; existing public.guardian_requests;
begin
  if requester is null then raise exception 'AUTH_REQUIRED'; end if;
  perform 1 from public.profiles where id = requester and role = 'A2' for update;
  if not found then raise exception 'GUARDIAN_REQUIRED'; end if;
  if coalesce(length(trim(rel)),0) = 0 then raise exception 'RELATION_REQUIRED'; end if;
  if exists(select 1 from public.care_links where guardian_id = requester and status = 'active') then
    raise exception 'ALREADY_LINKED';
  end if;
  select id into elder from public.profiles where invite_code = upper(trim(code)) and role = 'A1';
  if elder is null then raise exception 'INVALID_CODE'; end if;
  select * into existing from public.guardian_requests where guardian_id = requester for update;
  if found and existing.status = 'pending' and existing.expires_at > now() then
    if existing.elder_id <> elder then raise exception 'REQUEST_PENDING'; end if;
    -- Retry after a lost response is idempotent and never extends consent expiry.
    return existing.id;
  end if;
  insert into public.guardian_requests(elder_id, guardian_id, relation)
    values(elder, requester, left(trim(rel),40))
    on conflict (guardian_id) do update set id = gen_random_uuid(), elder_id = excluded.elder_id,
      relation = excluded.relation, status = 'pending', created_at = now(), expires_at = now() + interval '24 hours'
    returning id into result;
  -- Every new attempt has a fresh ID; an old approval button cannot approve it.
  return result;
end; $$;

create or replace function public.resolve_guardian_request(request_id uuid, accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.guardian_requests; guardian uuid;
begin
  select guardian_id into guardian from public.guardian_requests where id = request_id and elder_id = auth.uid();
  if guardian is null or accept is null then raise exception 'REQUEST_NOT_ALLOWED'; end if;
  -- Same lock order as request creation to serialize retries and approvals.
  perform 1 from public.profiles where id = guardian for update;
  select * into r from public.guardian_requests where id = request_id for update;
  if not found or r.elder_id <> auth.uid() or auth.uid() is null then raise exception 'REQUEST_NOT_ALLOWED'; end if;
  if r.status <> 'pending' or r.expires_at <= now() then raise exception 'REQUEST_EXPIRED'; end if;
  if accept then
    if exists(select 1 from public.care_links where guardian_id = guardian and status = 'active') then raise exception 'ALREADY_LINKED'; end if;
    insert into public.care_links(elder_id,guardian_id,relation) values(r.elder_id,r.guardian_id,r.relation)
    on conflict(elder_id,guardian_id) do update set status = 'active', relation = excluded.relation, linked_at = now();
  end if;
  update public.guardian_requests set status = case when accept then 'approved' else 'rejected' end where id = r.id;
end; $$;

-- Visit mutations check the authenticated owner and serialize per owner.
-- Existing duplicate historical data is preserved; retrying a new insert returns the existing ID.
create or replace function public.save_checkup_visit(visit_date date, visit_id uuid default null, previous_date date default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare owner uuid := auth.uid(); result uuid;
begin
  if owner is null then raise exception 'AUTH_REQUIRED'; end if;
  perform 1 from public.profiles where id = owner and role = 'A1' for update;
  if not found then raise exception 'VISIT_NOT_ALLOWED'; end if;
  -- One-day allowance handles local calendar dates ahead of the database timezone.
  if visit_date is null or visit_date < date '1900-01-01' or visit_date > current_date + 1 then raise exception 'INVALID_VISIT_DATE'; end if;
  if visit_id is null then
    select id into result from public.checkups where user_id = owner and visited_on = visit_date order by id limit 1;
    if result is not null then return result; end if;
    insert into public.checkups(user_id,visited_on) values(owner,visit_date) returning id into result;
  else
    perform 1 from public.checkups where id = visit_id and user_id = owner and visited_on = previous_date for update;
    if not found then raise exception 'VISIT_CHANGED'; end if;
    if exists(select 1 from public.checkups where user_id = owner and visited_on = visit_date and id <> visit_id) then raise exception 'VISIT_DUPLICATE'; end if;
    update public.checkups set visited_on = visit_date, next_recall_on = null, interval_months = null where id = visit_id returning id into result;
  end if;
  return result;
end; $$;

create or replace function public.delete_checkup_visit(visit_id uuid, previous_date date)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.profiles where id = auth.uid() and role = 'A1' for update;
  if not found then raise exception 'VISIT_NOT_ALLOWED'; end if;
  delete from public.checkups where id = visit_id and user_id = auth.uid() and visited_on = previous_date;
  if not found then raise exception 'VISIT_CHANGED'; end if;
end; $$;
revoke all on function public.link_with_invite_code(text,text), public.resolve_guardian_request(uuid,boolean), public.save_checkup_visit(date,uuid,date), public.delete_checkup_visit(uuid,date) from public, anon;
grant execute on function public.link_with_invite_code(text,text), public.resolve_guardian_request(uuid,boolean), public.save_checkup_visit(date,uuid,date), public.delete_checkup_visit(uuid,date) to authenticated;
commit;
