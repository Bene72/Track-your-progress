-- ============================================================
-- BOXLOG — Migration v2
-- À coller dans Supabase → SQL Editor → Run, APRÈS supabase_schema.sql
--
-- Ce fichier corrige un décalage schéma/code déjà présent en prod :
--   - le code (lib/hooks/usePersonalTraining.js) lit/écrit dans
--     personal_exercises / personal_blocks / personal_block_exercises /
--     personal_set_logs, mais AUCUNE de ces tables n'existait dans
--     supabase_schema.sql → la page "Perso" plante dès qu'on branche
--     un projet Supabase neuf.
--   - lib/db-columns.js et app/dashboard/box/page.js lisent/écrivent
--     box_invites.expires_at / max_uses / uses_count, colonnes elles
--     aussi absentes du schéma d'origine.
-- Et ajoute les deux fonctionnalités demandées :
--   - chat de box (temps réel)
--   - lien vidéo par mouvement, exploitable par le menu
--     "Voir la vidéo / Historique / PRs"
-- ============================================================

-- ─── 0. WODs : lien vidéo (démo technique du coach) ────────────
alter table public.wods
  add column if not exists video_url text;

-- ─── 1. box_invites : colonnes manquantes ─────────────────────
alter table public.box_invites
  add column if not exists expires_at timestamptz,
  add column if not exists max_uses   int,
  add column if not exists uses_count int not null default 0;

-- Incrémente uses_count et respecte expiration/quota à chaque jointure.
create or replace function public.join_box_via_code(invite_code text)
returns uuid language plpgsql security definer as $$
declare inv record; result_box_id uuid;
begin
  select * into inv from public.box_invites
    where code = invite_code and active = true limit 1;
  if inv is null then
    raise exception 'Code invalide ou expiré';
  end if;
  if inv.expires_at is not null and inv.expires_at < now() then
    raise exception 'Ce code a expiré';
  end if;
  if inv.max_uses is not null and inv.uses_count >= inv.max_uses then
    raise exception 'Ce code a atteint son nombre maximal d''utilisations';
  end if;

  insert into public.box_members (box_id, user_id, role, status)
    values (inv.box_id, auth.uid(), inv.role, 'active')
    on conflict (box_id, user_id) do update set status = 'active';

  update public.box_invites set uses_count = uses_count + 1 where id = inv.id;

  result_box_id := inv.box_id;
  return result_box_id;
end;
$$;

-- ─── 2. Catalogue d'exercices persos (+ lien vidéo) ───────────
create table if not exists public.personal_exercises (
  id            uuid primary key default uuid_generate_v4(),
  owner_id      uuid references auth.users(id) on delete cascade, -- null = exercice par défaut, partagé
  name          text not null,
  muscle_group  text not null,
  video_url     text,             -- lien démo (YouTube, Loom, fichier coach, etc.)
  is_default    boolean not null default false,
  created_at    timestamptz default now()
);
alter table public.personal_exercises enable row level security;

create policy "personal_exercises_select" on public.personal_exercises
  for select using (is_default = true or owner_id = auth.uid());
create policy "personal_exercises_write_own" on public.personal_exercises
  for insert with check (owner_id = auth.uid());
create policy "personal_exercises_update_own" on public.personal_exercises
  for update using (owner_id = auth.uid());
create policy "personal_exercises_delete_own" on public.personal_exercises
  for delete using (owner_id = auth.uid());

create index if not exists idx_personal_exercises_owner on public.personal_exercises(owner_id);

-- ─── 3. Blocs d'une séance perso ───────────────────────────────
create table if not exists public.personal_blocks (
  id               uuid primary key default uuid_generate_v4(),
  session_id       uuid not null references public.personal_sessions(id) on delete cascade,
  position         int not null default 0,
  block_type       text not null default 'straight_sets'
                     check (block_type in ('straight_sets','superset','emom','amrap','for_time')),
  rounds           int,
  interval_sec     int,
  time_cap_sec     int,
  result_time_sec  int,
  result_rounds    int,
  result_reps      int,
  notes            text,
  created_at       timestamptz default now()
);
alter table public.personal_blocks enable row level security;

create policy "personal_blocks_owner" on public.personal_blocks
  for all using (
    session_id in (select id from public.personal_sessions where user_id = auth.uid())
  );

create index if not exists idx_personal_blocks_session on public.personal_blocks(session_id, position);

-- ─── 4. Mouvements rattachés à un bloc ─────────────────────────
create table if not exists public.personal_block_exercises (
  id                 uuid primary key default uuid_generate_v4(),
  block_id           uuid not null references public.personal_blocks(id) on delete cascade,
  exercise_id        uuid not null references public.personal_exercises(id) on delete restrict,
  position           int not null default 0,
  target_reps        int,
  target_weight_kg   numeric(6,2),
  target_distance_m  numeric(8,2),
  created_at         timestamptz default now()
);
alter table public.personal_block_exercises enable row level security;

create policy "personal_block_exercises_owner" on public.personal_block_exercises
  for all using (
    block_id in (
      select b.id from public.personal_blocks b
      join public.personal_sessions s on s.id = b.session_id
      where s.user_id = auth.uid()
    )
  );

create index if not exists idx_pbe_block on public.personal_block_exercises(block_id, position);
create index if not exists idx_pbe_exercise on public.personal_block_exercises(exercise_id);

-- ─── 5. Logs de séries (un par round par mouvement) ────────────
create table if not exists public.personal_set_logs (
  id                  uuid primary key default uuid_generate_v4(),
  block_exercise_id   uuid not null references public.personal_block_exercises(id) on delete cascade,
  round_number        int not null,
  reps                int,
  weight_kg           numeric(6,2),
  distance_m          numeric(8,2),
  rest_sec            int,
  rpe                 numeric(3,1),
  created_at          timestamptz default now(),
  unique(block_exercise_id, round_number)
);
alter table public.personal_set_logs enable row level security;

create policy "personal_set_logs_owner" on public.personal_set_logs
  for all using (
    block_exercise_id in (
      select be.id from public.personal_block_exercises be
      join public.personal_blocks b on b.id = be.block_id
      join public.personal_sessions s on s.id = b.session_id
      where s.user_id = auth.uid()
    )
  );

create index if not exists idx_set_logs_block_exercise on public.personal_set_logs(block_exercise_id, round_number);

-- ─── 6. Vue "historique par mouvement" ──────────────────────────
-- Utilisée par le bouton "Historique" du menu d'un mouvement : toutes les
-- performances passées de l'utilisateur sur cet exercice, les plus
-- récentes d'abord, avec la date de la séance.
create or replace view public.personal_exercise_history
  with (security_invoker = on) as
  select
    s.user_id,
    be.exercise_id,
    s.session_date,
    b.block_type,
    log.round_number,
    log.reps,
    log.weight_kg,
    log.distance_m,
    log.rpe
  from public.personal_set_logs log
  join public.personal_block_exercises be on be.id = log.block_exercise_id
  join public.personal_blocks b on b.id = be.block_id
  join public.personal_sessions s on s.id = b.session_id
  order by s.session_date desc, log.round_number asc;

-- ─── 7. Seed d'un petit catalogue par défaut (idempotent) ──────
insert into public.personal_exercises (name, muscle_group, is_default)
select v.name, v.muscle_group, true
from (values
  ('Back Squat', 'jambes'), ('Front Squat', 'jambes'), ('Deadlift', 'dos'),
  ('Bench Press', 'pectoraux'), ('Overhead Press', 'epaules'), ('Pull Up', 'dos'),
  ('Push Up', 'pectoraux'), ('Row', 'cardio'), ('Ski Erg', 'cardio'), ('Bike Erg', 'cardio'),
  ('Assault Bike', 'cardio'), ('Wall Ball', 'jambes'), ('Kettlebell Swing', 'fessiers'),
  ('Burpee', 'cardio'), ('Box Jump', 'jambes'), ('Thruster', 'jambes')
) as v(name, muscle_group)
where not exists (
  select 1 from public.personal_exercises pe where pe.name = v.name and pe.is_default = true
);

-- ============================================================
-- 8. CHAT DE BOX (temps réel)
-- Un salon "general" par box (comme dans la capture Slack-like fournie),
-- extensible plus tard à des salons multiples (channel = clé libre).
-- ============================================================
create table if not exists public.chat_messages (
  id          uuid primary key default uuid_generate_v4(),
  box_id      uuid not null references public.boxes(id) on delete cascade,
  channel     text not null default 'general',
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- Rattache optionnellement le message à un WOD ou une séance perso, pour
  -- pouvoir afficher un fil de discussion sous un WOD précis (cf. capture
  -- coach/adhérent commentant une séance) en plus du chat général de box.
  wod_id      uuid references public.wods(id) on delete cascade,
  session_id  uuid references public.personal_sessions(id) on delete cascade,
  content     text not null check (char_length(trim(content)) > 0 and char_length(content) <= 2000),
  created_at  timestamptz default now()
);
alter table public.chat_messages enable row level security;

create policy "chat_select_box_member" on public.chat_messages
  for select using (box_id in (select public.my_box_ids()));
create policy "chat_insert_box_member" on public.chat_messages
  for insert with check (
    user_id = auth.uid()
    and box_id in (select public.my_box_ids())
  );
create policy "chat_delete_own_or_coach" on public.chat_messages
  for delete using (user_id = auth.uid() or public.is_box_coach(box_id));

create index if not exists idx_chat_box_channel on public.chat_messages(box_id, channel, created_at desc);
create index if not exists idx_chat_wod on public.chat_messages(wod_id);
create index if not exists idx_chat_session on public.chat_messages(session_id);

-- Active le flux Realtime Postgres Changes pour cette table (nécessaire pour
-- que useBoxChat.js reçoive les nouveaux messages sans recharger la page).
-- Dans Supabase, cela peut aussi se faire depuis Database → Replication.
alter publication supabase_realtime add table public.chat_messages;

-- ============================================================
-- FIN DE LA MIGRATION v2
-- ============================================================
