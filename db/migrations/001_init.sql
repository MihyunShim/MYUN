-- ============================================================
-- DentureCare 초기 스키마 (설계 문서 docs/설계/03, 04 기반)
-- 사용법: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run
-- ============================================================

-- ---------- 1. 테이블 ----------

-- 사용자 프로필 (로그인 계정 auth.users와 1:1)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'A1' check (role in ('A1','A2')),
  name text not null default '',
  birth_year int,
  phone text,
  font_size_mode text not null default 'normal' check (font_size_mode in ('normal','large')),
  invite_code text unique,          -- 보호자 연결용 6자리 코드
  created_at timestamptz not null default now()
);

-- 틀니 정보 (A1 사용자당 1개)
create table public.dentures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  made_year int not null,
  made_month int not null check (made_month between 1 and 12),
  clinic_name text,
  clinic_phone text,
  unique (user_id)
);

-- 일일 루틴 설정 (사용자당 5개 슬롯)
create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  slot text not null check (slot in ('A00','A01','A02','A03','A04')),
  alarm_time time not null,
  label text not null,
  enabled boolean not null default true,
  unique (user_id, slot)
);

-- 루틴 수행 기록 (하루에 슬롯당 1번만 — 중복 체크 방지)
create table public.routine_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  slot text not null check (slot in ('A00','A01','A02','A03','A04')),
  log_date date not null default current_date,
  done_at timestamptz not null default now(),
  done_by text not null default 'self' check (done_by in ('self','guardian_proxy')),
  unique (user_id, slot, log_date)
);

-- 치과 검진 기록
create table public.checkups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  visited_on date not null,
  next_recall_on date not null,
  interval_months int not null,
  memo text
);

-- 어르신-보호자 연결
create table public.care_links (
  id uuid primary key default gen_random_uuid(),
  elder_id uuid not null references public.profiles(id) on delete cascade,
  guardian_id uuid not null references public.profiles(id) on delete cascade,
  relation text,
  status text not null default 'active' check (status in ('active','revoked')),
  linked_at timestamptz not null default now(),
  unique (elder_id, guardian_id)
);

-- 알림 (응급 신고, 루틴 미수행, 검진 임박)
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  elder_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('emergency','missed','recall')),
  detail text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- ---------- 2. 가입 시 프로필 자동 생성 ----------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, name, invite_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'A1'),
    coalesce(new.raw_user_meta_data->>'name', ''),
    upper(substr(md5(random()::text), 1, 6))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 3. 접근 권한 (RLS) ----------
-- 원칙: 본인은 자기 데이터 읽기/쓰기, 연결된 보호자는 읽기만.

alter table public.profiles     enable row level security;
alter table public.dentures     enable row level security;
alter table public.routines     enable row level security;
alter table public.routine_logs enable row level security;
alter table public.checkups     enable row level security;
alter table public.care_links   enable row level security;
alter table public.alerts       enable row level security;

-- "내가 이 어르신의 활성 보호자인가?" 판정 함수
create or replace function public.is_guardian_of(elder uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from care_links
    where elder_id = elder and guardian_id = auth.uid() and status = 'active'
  );
$$;

-- profiles
create policy "own profile read"   on public.profiles for select using (id = auth.uid() or public.is_guardian_of(id));
create policy "own profile update" on public.profiles for update using (id = auth.uid());

-- dentures
create policy "denture read"  on public.dentures for select using (user_id = auth.uid() or public.is_guardian_of(user_id));
create policy "denture write" on public.dentures for insert with check (user_id = auth.uid());
create policy "denture edit"  on public.dentures for update using (user_id = auth.uid());

-- routines
create policy "routine read"  on public.routines for select using (user_id = auth.uid() or public.is_guardian_of(user_id));
create policy "routine write" on public.routines for insert with check (user_id = auth.uid());
create policy "routine edit"  on public.routines for update using (user_id = auth.uid());

-- routine_logs (보호자는 읽기 전용)
create policy "log read"  on public.routine_logs for select using (user_id = auth.uid() or public.is_guardian_of(user_id));
create policy "log write" on public.routine_logs for insert with check (user_id = auth.uid());

-- checkups
create policy "checkup read"  on public.checkups for select using (user_id = auth.uid() or public.is_guardian_of(user_id));
create policy "checkup write" on public.checkups for insert with check (user_id = auth.uid());

-- care_links (연결 생성은 아래 RPC 함수로만 — 직접 INSERT 불가)
create policy "link read"   on public.care_links for select using (elder_id = auth.uid() or guardian_id = auth.uid());
create policy "link revoke" on public.care_links for update using (elder_id = auth.uid() or guardian_id = auth.uid());

-- alerts
create policy "alert create" on public.alerts for insert with check (elder_id = auth.uid());
create policy "alert read"   on public.alerts for select using (elder_id = auth.uid() or public.is_guardian_of(elder_id));
create policy "alert ack"    on public.alerts for update using (public.is_guardian_of(elder_id));

-- ---------- 4. 초대코드로 보호자 연결 (RPC) ----------
-- 프로필 테이블을 노출하지 않고 코드 일치 확인 + 연결 생성까지 서버에서 처리

create or replace function public.link_with_invite_code(code text, rel text)
returns uuid language plpgsql security definer set search_path = public as $$
declare elder uuid;
begin
  select id into elder from profiles where invite_code = upper(trim(code)) and role = 'A1';
  if elder is null then
    raise exception 'INVALID_CODE';
  end if;
  if elder = auth.uid() then
    raise exception 'CANNOT_LINK_SELF';
  end if;
  insert into care_links (elder_id, guardian_id, relation)
  values (elder, auth.uid(), rel)
  on conflict (elder_id, guardian_id)
  do update set status = 'active', relation = excluded.relation, linked_at = now();
  return elder;
end;
$$;

-- ---------- 5. 실시간 알림 (보호자 폰에 응급 즉시 전달) ----------
alter publication supabase_realtime add table public.alerts;
