-- ============================================================
-- BOXLOG — Migration v3
-- À exécuter après supabase_migration_v2.sql (Supabase → SQL Editor → Run)
--
-- Ajoute :
--   - notes persistantes par mouvement (indépendantes de l'exercice partagé,
--     pour pouvoir mettre une consigne perso même sur un exercice du
--     catalogue par défaut)
--   - modèles de séance réutilisables (templates)
--   - rien à ajouter pour le drag & drop de blocs : personal_blocks.position
--     existe déjà, on se contente de le mettre à jour depuis le client
-- ============================================================

-- ─── 1. Note persistante par mouvement (par utilisateur) ───────
-- Séparée de personal_exercises.note pour que ça marche aussi sur les
-- exercices "par défaut" (owner_id = null, partagés), sur lesquels un
-- utilisateur seul n'a pas le droit d'écrire.
create table if not exists public.personal_exercise_notes (
  user_id      uuid not null references auth.users(id) on delete cascade,
  exercise_id  uuid not null references public.personal_exercises(id) on delete cascade,
  note         text not null check (char_length(note) <= 1000),
  updated_at   timestamptz default now(),
  primary key (user_id, exercise_id)
);
alter table public.personal_exercise_notes enable row level security;

create policy "personal_exercise_notes_owner" on public.personal_exercise_notes
  for all using (user_id = auth.uid());

-- ─── 2. Modèles de séance (templates) réutilisables ────────────
create table if not exists public.personal_templates (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  created_at  timestamptz default now()
);
alter table public.personal_templates enable row level security;
create policy "personal_templates_owner" on public.personal_templates
  for all using (owner_id = auth.uid());

create table if not exists public.personal_template_blocks (
  id            uuid primary key default uuid_generate_v4(),
  template_id   uuid not null references public.personal_templates(id) on delete cascade,
  position      int not null default 0,
  block_type    text not null default 'straight_sets'
                  check (block_type in ('straight_sets','superset','emom','amrap','for_time')),
  rounds        int,
  interval_sec  int,
  time_cap_sec  int,
  notes         text
);
alter table public.personal_template_blocks enable row level security;
create policy "personal_template_blocks_owner" on public.personal_template_blocks
  for all using (
    template_id in (select id from public.personal_templates where owner_id = auth.uid())
  );

create table if not exists public.personal_template_block_exercises (
  id                 uuid primary key default uuid_generate_v4(),
  template_block_id  uuid not null references public.personal_template_blocks(id) on delete cascade,
  exercise_id        uuid not null references public.personal_exercises(id) on delete restrict,
  position           int not null default 0,
  target_reps        int,
  target_weight_kg   numeric(6,2),
  target_distance_m  numeric(8,2)
);
alter table public.personal_template_block_exercises enable row level security;
create policy "personal_template_block_exercises_owner" on public.personal_template_block_exercises
  for all using (
    template_block_id in (
      select tb.id from public.personal_template_blocks tb
      join public.personal_templates t on t.id = tb.template_id
      where t.owner_id = auth.uid()
    )
  );

create index if not exists idx_template_blocks_template on public.personal_template_blocks(template_id, position);
create index if not exists idx_template_block_ex_block on public.personal_template_block_exercises(template_block_id, position);

-- ============================================================
-- FIN DE LA MIGRATION v3
-- ============================================================
