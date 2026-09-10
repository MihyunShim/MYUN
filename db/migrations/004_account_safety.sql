-- 운영 적용 전 별도 Supabase 프로젝트에서 검증하세요. 기존 데이터를 삭제하지 않습니다.
begin;

-- 연결 행의 ID를 바꿔 다른 사용자의 기록을 읽지 못하게 수정 가능한 열을 제한한다.
revoke update on public.care_links from public, anon, authenticated;
grant update (status) on public.care_links to authenticated;
drop policy if exists "link revoke" on public.care_links;
create policy "link revoke" on public.care_links for update to authenticated
  using (elder_id = auth.uid() or guardian_id = auth.uid())
  with check ((elder_id = auth.uid() or guardian_id = auth.uid()) and status = 'revoked');

-- 보호자는 도움 요청 본문/소유자를 수정할 수 없고 읽음 표시만 할 수 있다.
revoke update on public.alerts from public, anon, authenticated;
grant update (read_at) on public.alerts to authenticated;

-- 해제한 가족이 예전 초대코드를 재사용하지 못하게 코드를 교체한다.
create or replace function public.rotate_invite_after_revoke()
returns trigger language plpgsql security definer set search_path = '' as $$
declare candidate text;
begin
  if old.status = 'active' and new.status = 'revoked' then
    loop
      candidate := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      begin
        update public.profiles set invite_code = candidate
          where id = new.elder_id and invite_code is distinct from candidate;
        if found then exit; end if;
      exception when unique_violation then
        null; -- 다른 계정의 코드와 겹치면 다시 생성한다.
      end;
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function public.rotate_invite_after_revoke() from public, anon, authenticated;
drop trigger if exists care_link_revoked on public.care_links;
create trigger care_link_revoked after update of status on public.care_links
  for each row execute function public.rotate_invite_after_revoke();

create or replace function public.link_with_invite_code(code text, rel text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare elder uuid; requester uuid := auth.uid();
begin
  if requester is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.profiles where id = requester and role = 'A2') then
    raise exception 'GUARDIAN_REQUIRED';
  end if;
  select id into elder from public.profiles
    where invite_code = upper(trim(code)) and role = 'A1' for update;
  if elder is null then raise exception 'INVALID_CODE'; end if;
  if elder = requester then raise exception 'CANNOT_LINK_SELF'; end if;
  insert into public.care_links (elder_id, guardian_id, relation)
    values (elder, requester, left(trim(rel), 40))
    on conflict (elder_id, guardian_id)
    do update set status = 'active', relation = excluded.relation, linked_at = now();
  return elder;
end;
$$;

-- 연결된 상대방 이름만 반환하며, 임의 사용자 조회는 받지 않는다.
create or replace function public.list_my_care_links()
returns table (link_id uuid, other_name text, relation text, linked_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, p.name, c.relation, c.linked_at
  from public.care_links c
  join public.profiles p on p.id = case when c.elder_id = auth.uid() then c.guardian_id else c.elder_id end
  where (c.elder_id = auth.uid() or c.guardian_id = auth.uid()) and c.status = 'active'
  order by c.linked_at desc;
$$;
revoke all on function public.list_my_care_links() from public, anon;
grant execute on function public.list_my_care_links() to authenticated;

-- 서비스 역할 키를 앱에 넣지 않고, 로그인한 본인만 탈퇴 가능하다.
-- 001의 ON DELETE CASCADE가 프로필/기록/연결/알림을 함께 삭제한다.
create or replace function public.delete_own_account()
returns void language plpgsql security definer set search_path = '' as $$
declare requester uuid := auth.uid();
begin
  if requester is null then raise exception 'AUTH_REQUIRED'; end if;
  delete from auth.users where id = requester;
end;
$$;
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

-- 서버 예약 작업을 일반 사용자가 임의로 실행하지 못하게 제한한다.
do $$ begin
  if to_regprocedure('public.flag_missed_routines()') is not null then
    revoke all on function public.flag_missed_routines() from public, anon, authenticated;
  end if;
end $$;

revoke all on function public.link_with_invite_code(text, text) from public, anon;
grant execute on function public.link_with_invite_code(text, text) to authenticated;

commit;
