-- ============================================================
-- BOXLOG — Migration v5
-- "Programme" : programmation individualisée coach → athlète (ou
-- auto-assignée), 2e pilier du produit aux côtés de Perso et des WOD de box.
-- À exécuter après v2, v3, v4 (Supabase → SQL Editor → Run).
--
-- Décisions actées avec l'utilisateur avant cette migration :
--   - Construction par "semaine type" dupliquée (pas séance par séance)
--   - Un programme = un seul athlète en V1 (multi-athlètes en V3)
--   - Un coach OU l'athlète lui-même peut créer un programme
--
-- Note d'ordonnancement : les fonctions SQL sont validées par Postgres au
-- moment de leur création (leurs références de tables doivent déjà
-- exister), donc chaque fonction utilitaire est déclarée juste après la
-- dernière table dont elle a besoin — pas toutes groupées à la fin.
-- ============================================================

-- ─── 1. Programme (racine) ──────────────────────────────────────
create table if not exists public.programs (
  id          uuid primary key default uuid_generate_v4(),
  box_id      uuid not null references public.boxes(id) on delete cascade,
  athlete_id  uuid not null references auth.users(id) on delete cascade,
  created_by  uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  start_date  date not null,
  status      text not null default 'draft' check (status in ('draft','active','completed','archived')),
  created_at  timestamptz default now()
);
alter table public.programs enable row level security;

create policy "programs_select" on public.programs
  for select using (athlete_id = auth.uid() or public.is_box_coach(box_id));
create policy "programs_insert" on public.programs
  for insert with check (
    created_by = auth.uid()
    and box_id in (select public.my_box_ids())
    and (athlete_id = auth.uid() or public.is_box_coach(box_id))
  );
create policy "programs_update" on public.programs
  for update using (public.is_box_coach(box_id) or created_by = auth.uid());
create policy "programs_delete" on public.programs
  for delete using (public.is_box_coach(box_id) or created_by = auth.uid());

create index if not exists idx_programs_athlete on public.programs(athlete_id);
create index if not exists idx_programs_box on public.programs(box_id);

create or replace function public.program_box_id_direct(p_program_id uuid)
returns uuid language sql security definer stable as $$
  select box_id from public.programs where id = p_program_id
$$;

-- ─── 2. Semaines (l'unité qu'on construit puis qu'on duplique) ──
create table if not exists public.program_weeks (
  id            uuid primary key default uuid_generate_v4(),
  program_id    uuid not null references public.programs(id) on delete cascade,
  week_number   int not null,
  label         text,
  created_at    timestamptz default now(),
  unique(program_id, week_number)
);
alter table public.program_weeks enable row level security;
create policy "program_weeks_rw" on public.program_weeks
  for all using (
    public.is_box_coach(public.program_box_id_direct(program_id))
    or program_id in (select id from public.programs where created_by = auth.uid())
    or program_id in (select id from public.programs where athlete_id = auth.uid())
  );

-- ─── 3. Séances (jour de semaine 0-6 + AM/PM, PAS de date en dur) ─
-- La date réelle = programs.start_date + (week_number-1)*7 + day_offset
-- (cf. vue program_sessions_expanded plus bas), pour dupliquer une semaine
-- type sans jamais retoucher de dates.
create table if not exists public.program_sessions (
  id                uuid primary key default uuid_generate_v4(),
  program_week_id   uuid not null references public.program_weeks(id) on delete cascade,
  day_offset        int not null check (day_offset between 0 and 6),
  period            text not null default 'unique' check (period in ('AM','PM','unique')),
  created_at        timestamptz default now(),
  unique(program_week_id, day_offset, period)
);
alter table public.program_sessions enable row level security;
create policy "program_sessions_rw" on public.program_sessions
  for all using (
    program_week_id in (
      select pw.id from public.program_weeks pw
      join public.programs p on p.id = pw.program_id
      where public.is_box_coach(p.box_id) or p.created_by = auth.uid() or p.athlete_id = auth.uid()
    )
  );

-- ─── 4. Blocs (les lignes A/ B/ C/ D/ d'une séance) ─────────────
create table if not exists public.program_blocks (
  id                  uuid primary key default uuid_generate_v4(),
  program_session_id  uuid not null references public.program_sessions(id) on delete cascade,
  position            int not null default 0,
  title               text not null,
  prescription        text,
  exercise_id         uuid references public.personal_exercises(id) on delete set null,
  video_url           text,
  notes               text,
  created_at          timestamptz default now()
);
alter table public.program_blocks enable row level security;
create policy "program_blocks_rw" on public.program_blocks
  for all using (
    program_session_id in (
      select ps.id from public.program_sessions ps
      join public.program_weeks pw on pw.id = ps.program_week_id
      join public.programs p on p.id = pw.program_id
      where public.is_box_coach(p.box_id) or p.created_by = auth.uid() or p.athlete_id = auth.uid()
    )
  );

create index if not exists idx_program_blocks_session on public.program_blocks(program_session_id, position);

-- ─── 5. Fonctions utilitaires dépendant de program_blocks ───────
create or replace function public.program_id_for_block(p_block_id uuid)
returns uuid language sql security definer stable as $$
  select pw.program_id
  from public.program_blocks pb
  join public.program_sessions ps on ps.id = pb.program_session_id
  join public.program_weeks pw on pw.id = ps.program_week_id
  where pb.id = p_block_id
$$;

create or replace function public.program_box_id_for_block(p_block_id uuid)
returns uuid language sql security definer stable as $$
  select p.box_id from public.programs p
  where p.id = public.program_id_for_block(p_block_id)
$$;

create or replace function public.program_athlete_id_for_block(p_block_id uuid)
returns uuid language sql security definer stable as $$
  select p.athlete_id from public.programs p
  where p.id = public.program_id_for_block(p_block_id)
$$;

-- ─── 6. Réponse de l'athlète à un bloc ──────────────────────────
create table if not exists public.program_block_logs (
  id            uuid primary key default uuid_generate_v4(),
  block_id      uuid not null references public.program_blocks(id) on delete cascade,
  athlete_id    uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending','done','skipped')),
  athlete_note  text,
  completed_at  timestamptz,
  updated_at    timestamptz default now(),
  unique(block_id, athlete_id)
);
alter table public.program_block_logs enable row level security;

create policy "program_block_logs_select" on public.program_block_logs
  for select using (
    athlete_id = auth.uid()
    or public.is_box_coach(public.program_box_id_for_block(block_id))
  );
create policy "program_block_logs_write" on public.program_block_logs
  for insert with check (athlete_id = auth.uid());
create policy "program_block_logs_update" on public.program_block_logs
  for update using (athlete_id = auth.uid());

-- ─── 7. Vue : séances avec date réelle calculée ─────────────────
create or replace view public.program_sessions_expanded
  with (security_invoker = on) as
  select
    ps.id as session_id,
    pw.program_id,
    p.box_id,
    p.athlete_id,
    pw.week_number,
    ps.day_offset,
    ps.period,
    (p.start_date + ((pw.week_number - 1) * 7 + ps.day_offset) * interval '1 day')::date as session_date
  from public.program_sessions ps
  join public.program_weeks pw on pw.id = ps.program_week_id
  join public.programs p on p.id = pw.program_id;

-- ─── 8. Fil de chat par bloc ─────────────────────────────────────
alter table public.chat_messages
  add column if not exists program_block_id uuid references public.program_blocks(id) on delete cascade;

drop policy if exists "chat_select_thread_scoped" on public.chat_messages;
create policy "chat_select_thread_scoped" on public.chat_messages
  for select using (
    (session_id is null and program_block_id is null and box_id in (select public.my_box_ids()))
    or (session_id is not null and (
         user_id = auth.uid()
         or session_id in (select id from public.personal_sessions where user_id = auth.uid())
         or public.is_box_coach(box_id)
       ))
    or (program_block_id is not null and (
         user_id = auth.uid()
         or public.is_box_coach(box_id)
         or auth.uid() = public.program_athlete_id_for_block(program_block_id)
       ))
  );

create index if not exists idx_chat_program_block on public.chat_messages(program_block_id);

-- ─── 9. Notifications : nouveau programme + réponse sous un bloc ─
alter table public.notifications
  drop constraint if exists notifications_type_check,
  add constraint notifications_type_check
    check (type in ('new_wod','chat_reply','new_program','program_reply'));

create or replace function public.notify_new_program()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'active' and new.athlete_id <> new.created_by then
    insert into public.notifications (user_id, type, title, body, link)
    values (new.athlete_id, 'new_program', 'Nouveau programme : ' || new.name, null, '/dashboard/programme/' || new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_new_program on public.programs;
create trigger trg_notify_new_program
  after insert on public.programs
  for each row execute function public.notify_new_program();

-- Remplace notify_new_chat_message() (v4) : CREATE OR REPLACE remplace
-- toute la définition, donc le corps complet est réécrit ici (et pas
-- seulement "complété") pour gérer aussi program_block_id.
create or replace function public.notify_new_chat_message()
returns trigger language plpgsql security definer as $$
declare wod_title text; session_owner uuid; v_athlete_id uuid; v_box_id uuid; v_program_name text;
begin
  if new.program_block_id is not null then
    v_athlete_id := public.program_athlete_id_for_block(new.program_block_id);
    v_box_id := public.program_box_id_for_block(new.program_block_id);
    select pr.name into v_program_name from public.programs pr
      where pr.id = public.program_id_for_block(new.program_block_id);

    if new.user_id = v_athlete_id then
      insert into public.notifications (user_id, type, title, body, link)
      select bm.user_id, 'program_reply', 'Réponse sur ' || coalesce(v_program_name, 'un programme'),
             left(new.content, 140), '/dashboard/programme'
      from public.box_members bm
      where bm.box_id = v_box_id and bm.status = 'active' and bm.role = 'coach' and bm.user_id <> new.user_id;
    else
      insert into public.notifications (user_id, type, title, body, link)
      values (v_athlete_id, 'program_reply', 'Nouveau message sur ' || coalesce(v_program_name, 'ton programme'),
              left(new.content, 140), '/dashboard/programme');
    end if;
    return new;
  end if;

  if new.session_id is not null then
    select user_id into session_owner from public.personal_sessions where id = new.session_id;
    if session_owner is not null and session_owner <> new.user_id then
      insert into public.notifications (user_id, type, title, body, link)
      values (session_owner, 'chat_reply', 'Nouveau message sur ta séance',
              left(new.content, 140), '/dashboard/perso');
    end if;
    return new;
  end if;

  if new.wod_id is not null then
    select title into wod_title from public.wods where id = new.wod_id;
    insert into public.notifications (user_id, type, title, body, link)
    select bm.user_id, 'chat_reply', 'Nouveau message — ' || coalesce(wod_title, 'un WOD'),
           left(new.content, 140), '/dashboard/wod/' || new.wod_id
    from public.box_members bm
    where bm.box_id = new.box_id and bm.status = 'active' and bm.user_id <> new.user_id;
    return new;
  end if;

  insert into public.notifications (user_id, type, title, body, link)
  select bm.user_id, 'chat_reply', 'Nouveau message dans le chat',
         left(new.content, 140), '/dashboard/chat'
  from public.box_members bm
  where bm.box_id = new.box_id and bm.status = 'active' and bm.user_id <> new.user_id;
  return new;
end;
$$;

-- ============================================================
-- FIN DE LA MIGRATION v5
-- ============================================================
