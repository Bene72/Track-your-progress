-- ============================================================
-- BOXLOG — Supabase Schema (multi-box / SugarWOD-like)
-- Colle ce SQL dans Supabase → SQL Editor → Run
-- Nécessite un projet Supabase avec Auth email/password activé
-- ============================================================

create extension if not exists "uuid-ossp";

-- ─── PROFILES ───────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz default now()
);
alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_all_own" on public.profiles
  for all using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── BOXES (salles / clients coachs) ─────────────────────────
create table if not exists public.boxes (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text unique,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz default now()
);
alter table public.boxes enable row level security;

-- ─── BOX MEMBERS (rôle par box : coach | member) ─────────────
create table if not exists public.box_members (
  id          uuid primary key default uuid_generate_v4(),
  box_id      uuid not null references public.boxes(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'member' check (role in ('coach','member')),
  status      text not null default 'active' check (status in ('active','removed')),
  joined_at   timestamptz default now(),
  unique(box_id, user_id)
);
alter table public.box_members enable row level security;

-- ─── BOX INVITES (code d'invitation pour rejoindre) ──────────
create table if not exists public.box_invites (
  id          uuid primary key default uuid_generate_v4(),
  box_id      uuid not null references public.boxes(id) on delete cascade,
  code        text not null unique,
  created_by  uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'member' check (role in ('coach','member')),
  active      boolean not null default true,
  created_at  timestamptz default now()
);
alter table public.box_invites enable row level security;

-- ─── HELPER FUNCTIONS (security definer → évite la récursion RLS) ─
create or replace function public.my_box_ids()
returns setof uuid language sql security definer stable as $$
  select box_id from public.box_members
  where user_id = auth.uid() and status = 'active'
$$;

create or replace function public.is_box_coach(bid uuid)
returns boolean language sql security definer stable as $$
  select exists(
    select 1 from public.box_members
    where box_id = bid and user_id = auth.uid()
      and role = 'coach' and status = 'active'
  )
$$;

create or replace function public.is_box_member(bid uuid)
returns boolean language sql security definer stable as $$
  select exists(
    select 1 from public.box_members
    where box_id = bid and user_id = auth.uid() and status = 'active'
  )
$$;

-- ─── RPC: créer une box (devient coach automatiquement) ──────
create or replace function public.create_box(box_name text)
returns uuid language plpgsql security definer as $$
declare new_box_id uuid;
begin
  if length(trim(box_name)) < 2 then
    raise exception 'Nom de box invalide';
  end if;
  insert into public.boxes (name, owner_id) values (trim(box_name), auth.uid())
    returning id into new_box_id;
  insert into public.box_members (box_id, user_id, role, status)
    values (new_box_id, auth.uid(), 'coach', 'active');
  return new_box_id;
end;
$$;

-- ─── RPC: rejoindre une box via code d'invitation ────────────
create or replace function public.join_box_via_code(invite_code text)
returns uuid language plpgsql security definer as $$
declare inv record; result_box_id uuid;
begin
  select * into inv from public.box_invites
    where code = invite_code and active = true limit 1;
  if inv is null then
    raise exception 'Code invalide ou expiré';
  end if;
  insert into public.box_members (box_id, user_id, role, status)
    values (inv.box_id, auth.uid(), inv.role, 'active')
    on conflict (box_id, user_id) do update set status = 'active';
  result_box_id := inv.box_id;
  return result_box_id;
end;
$$;

-- ─── POLICIES: boxes ──────────────────────────────────────────
create policy "boxes_select_member" on public.boxes
  for select using (id in (select public.my_box_ids()) or owner_id = auth.uid());
create policy "boxes_update_coach" on public.boxes
  for update using (owner_id = auth.uid() or public.is_box_coach(id));

-- ─── POLICIES: box_members ────────────────────────────────────
create policy "members_select_same_box" on public.box_members
  for select using (user_id = auth.uid() or box_id in (select public.my_box_ids()));
create policy "members_insert_coach" on public.box_members
  for insert with check (public.is_box_coach(box_id));
create policy "members_update_coach_or_self_leave" on public.box_members
  for update using (public.is_box_coach(box_id) or user_id = auth.uid());
create policy "members_delete_coach_or_self" on public.box_members
  for delete using (public.is_box_coach(box_id) or user_id = auth.uid());

-- ─── POLICIES: box_invites ─────────────────────────────────────
create policy "invites_select_member" on public.box_invites
  for select using (box_id in (select public.my_box_ids()));
create policy "invites_write_coach" on public.box_invites
  for all using (public.is_box_coach(box_id));

-- ─── WODS ───────────────────────────────────────────────────
-- format: 'for_time' | 'amrap' | 'emom' | 'strength' | 'custom'
-- status: 'published' (visible de tous) | 'pending' (proposé par un adhérent, en attente de validation coach) | 'rejected'
create table if not exists public.wods (
  id              uuid primary key default uuid_generate_v4(),
  box_id          uuid not null references public.boxes(id) on delete cascade,
  created_by      uuid not null references auth.users(id) on delete cascade,
  wod_date        date not null default current_date,
  title           text not null,
  format          text not null default 'for_time' check (format in ('for_time','amrap','emom','strength','custom')),
  time_cap_sec    int,                    -- cap pour for_time / amrap
  emom_interval_sec int,                  -- ex: 60 (chaque minute)
  emom_rounds     int,                    -- nombre de rounds EMOM
  description     text not null,          -- le WOD lui-même (mouvements, reps, etc.)
  scoring_type    text not null default 'time' check (scoring_type in ('time','rounds_reps','load','reps','none')),
  is_benchmark    boolean default false,  -- ex: "Fran", "Murph"
  status          text not null default 'published' check (status in ('published','pending','rejected')),
  created_at      timestamptz default now()
);
alter table public.wods enable row level security;

-- Un adhérent qui propose un WOD → statut pending automatique (sauf coach)
create or replace function public.set_wod_status()
returns trigger language plpgsql as $$
begin
  if public.is_box_coach(new.box_id) then
    if new.status is null then new.status := 'published'; end if;
  else
    new.status := 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_wod_status on public.wods;
create trigger trg_wod_status
  before insert on public.wods
  for each row execute procedure public.set_wod_status();

create policy "wods_select_box" on public.wods
  for select using (
    box_id in (select public.my_box_ids())
    and (status = 'published' or created_by = auth.uid() or public.is_box_coach(box_id))
  );
create policy "wods_insert_member" on public.wods
  for insert with check (box_id in (select public.my_box_ids()) and created_by = auth.uid());
create policy "wods_update_coach_or_own_pending" on public.wods
  for update using (
    public.is_box_coach(box_id)
    or (created_by = auth.uid() and status = 'pending')
  );
create policy "wods_delete_coach_or_own_pending" on public.wods
  for delete using (
    public.is_box_coach(box_id)
    or (created_by = auth.uid() and status = 'pending')
  );

-- ─── WOD SCORES (un score par adhérent par WOD) ──────────────
create table if not exists public.wod_scores (
  id              uuid primary key default uuid_generate_v4(),
  wod_id          uuid not null references public.wods(id) on delete cascade,
  box_id          uuid not null references public.boxes(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  rx              boolean not null default true,   -- RX ou Scaled
  time_seconds    int,                              -- for_time
  rounds          int,                              -- amrap : rounds complets
  extra_reps      int,                              -- amrap : reps du round partiel
  load_kg         numeric(6,2),                     -- strength : charge
  reps            int,                              -- reps totales (emom raté, max reps, etc.)
  notes           text,
  created_at      timestamptz default now(),
  unique(wod_id, user_id)
);
alter table public.wod_scores enable row level security;

create policy "scores_select_box" on public.wod_scores
  for select using (box_id in (select public.my_box_ids()));
create policy "scores_write_own" on public.wod_scores
  for all using (user_id = auth.uid() and box_id in (select public.my_box_ids()));

create index if not exists idx_scores_wod on public.wod_scores(wod_id);
create index if not exists idx_wods_box_date on public.wods(box_id, wod_date desc);

-- ─── PERSONAL SESSIONS (journal perso, hors WOD de box) ──────
create table if not exists public.personal_sessions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  box_id      uuid references public.boxes(id) on delete set null,
  session_date date not null default current_date,
  title       text,
  notes       text,
  created_at  timestamptz default now()
);
alter table public.personal_sessions enable row level security;
create policy "personal_sessions_own" on public.personal_sessions
  for all using (user_id = auth.uid());

-- ─── PERSONAL RECORDS (PR par mouvement) ──────────────────────
create table if not exists public.personal_records (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  session_id    uuid references public.personal_sessions(id) on delete set null,
  movement      text not null,                 -- ex: "Back Squat", "Fran", "5k Row"
  value_type    text not null check (value_type in ('weight','time','reps')),
  value_number  numeric(10,2) not null,        -- kg, secondes, ou reps selon value_type
  achieved_at   date not null default current_date,
  notes         text,
  created_at    timestamptz default now()
);
alter table public.personal_records enable row level security;
create policy "personal_records_own" on public.personal_records
  for all using (user_id = auth.uid());

create index if not exists idx_pr_user_movement on public.personal_records(user_id, movement, achieved_at desc);

-- ─── VUE: dernier PR par mouvement et par user ────────────────
create or replace view public.personal_records_latest
  with (security_invoker = on) as
  select distinct on (user_id, movement)
    user_id, movement, value_type, value_number, achieved_at, notes
  from public.personal_records
  order by user_id, movement,
    case value_type when 'time' then value_number end asc nulls last,
    case value_type when 'weight' then value_number end desc nulls last,
    case value_type when 'reps' then value_number end desc nulls last;

-- ============================================================
-- FIN DU SCHEMA
-- ============================================================
