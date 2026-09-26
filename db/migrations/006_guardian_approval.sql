-- Apply after 005. Existing active connections remain active.
begin;
create table public.guardian_requests (
  id uuid primary key default gen_random_uuid(),
  elder_id uuid not null references public.profiles(id) on delete cascade,
  guardian_id uuid not null unique references public.profiles(id) on delete cascade,
  relation text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);
alter table public.guardian_requests enable row level security;
revoke all on public.guardian_requests from public, anon, authenticated;

-- All clients, including older versions, must request approval. Code possession never grants reads.
create or replace function public.link_with_invite_code(code text, rel text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare elder uuid; requester uuid := auth.uid(); result uuid;
begin
  if requester is null then raise exception 'AUTH_REQUIRED'; end if;
  perform 1 from public.profiles where id = requester and role = 'A2' for update;
  if not found then raise exception 'GUARDIAN_REQUIRED'; end if;
  if length(trim(rel)) = 0 then raise exception 'RELATION_REQUIRED'; end if;
  select id into elder from public.profiles where invite_code = upper(trim(code)) and role = 'A1';
  if elder is null then raise exception 'INVALID_CODE'; end if;
  if elder = requester then raise exception 'CANNOT_LINK_SELF'; end if;
  if exists (select 1 from public.guardian_requests where guardian_id = requester and status = 'pending' and expires_at > now() and elder_id <> elder) then
    raise exception 'REQUEST_PENDING';
  end if;
  insert into public.guardian_requests(elder_id, guardian_id, relation)
    values(elder, requester, left(trim(rel),40))
    on conflict (guardian_id) do update set elder_id = excluded.elder_id, relation = excluded.relation,
      status = 'pending', created_at = now(), expires_at = now() + interval '24 hours'
    returning id into result;
  return result;
end; $$;

-- Explicit new RPC prevents new clients silently linking against an un-migrated server.
create function public.request_guardian_connection(code text, rel text)
returns uuid language sql security definer set search_path = '' as $$
  select public.link_with_invite_code(code, rel);
$$;

create function public.list_guardian_requests()
returns table(id uuid, other_name text, relation text, status text, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, case when r.elder_id = auth.uid() then p.name else '틀니 사용자' end,
    r.relation, case when r.status = 'pending' and r.expires_at <= now() then 'expired' else r.status end, r.expires_at
  from public.guardian_requests r join public.profiles p on p.id = r.guardian_id
  where (r.elder_id = auth.uid() and r.status = 'pending' and r.expires_at > now()) or r.guardian_id = auth.uid()
  order by r.created_at desc;
$$;

create function public.resolve_guardian_request(request_id uuid, accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.guardian_requests;
begin
  select * into r from public.guardian_requests where id = request_id for update;
  if not found or r.elder_id <> auth.uid() or auth.uid() is null then raise exception 'REQUEST_NOT_ALLOWED'; end if;
  if r.status <> 'pending' or r.expires_at <= now() then raise exception 'REQUEST_EXPIRED'; end if;
  if accept then
    insert into public.care_links(elder_id,guardian_id,relation) values(r.elder_id,r.guardian_id,r.relation)
    on conflict(elder_id,guardian_id) do update set status = 'active', relation = excluded.relation, linked_at = now();
  end if;
  update public.guardian_requests set status = case when accept then 'approved' else 'rejected' end where id = r.id;
end; $$;

create function public.cancel_guardian_request(request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.guardian_requests set status = 'cancelled' where id = request_id and guardian_id = auth.uid() and status = 'pending';
  if not found then raise exception 'REQUEST_NOT_ALLOWED'; end if;
end; $$;

revoke all on function public.request_guardian_connection(text,text), public.list_guardian_requests(), public.resolve_guardian_request(uuid,boolean), public.cancel_guardian_request(uuid) from public, anon;
grant execute on function public.request_guardian_connection(text,text), public.list_guardian_requests(), public.resolve_guardian_request(uuid,boolean), public.cancel_guardian_request(uuid) to authenticated;
create function public.cancel_request_after_unlink()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'revoked' then
    update public.guardian_requests set status = 'cancelled'
    where elder_id = new.elder_id and guardian_id = new.guardian_id and status in ('pending','approved');
  end if;
  return new;
end; $$;
revoke all on function public.cancel_request_after_unlink() from public, anon, authenticated;
create trigger cancel_guardian_request_after_unlink after update of status on public.care_links
for each row execute function public.cancel_request_after_unlink();
commit;
