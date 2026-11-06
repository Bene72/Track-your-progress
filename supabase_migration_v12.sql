-- ============================================================
-- BOXLOG — Migration v12
-- À exécuter après v2 à v11 (Supabase → SQL Editor → Run)
--
--   1. program_blocks.is_optional : tag « Optionnel » sur un bloc
--      (échauffement, finisher, mobilité… que l'athlète peut sauter).
--   2. program_day_feelings : « ressenti du jour » — l'athlète note sa
--      séance de 1 à 5 + un mot ; le coach de la box peut le lire.
--   3. create_cycle / duplicate_program : prennent en compte is_optional
--      (clé JSON "is_optional": true dans un bloc de create_cycle).
-- Idempotent : peut être rejouée sans erreur.
-- ============================================================

-- ─── 1. Blocs optionnels ────────────────────────────────────────
alter table public.program_blocks
  add column if not exists is_optional boolean not null default false;

-- ─── 2. Ressenti du jour ────────────────────────────────────────
create table if not exists public.program_day_feelings (
  id            uuid primary key default uuid_generate_v4(),
  program_id    uuid not null references public.programs(id) on delete cascade,
  athlete_id    uuid not null references auth.users(id) on delete cascade,
  feeling_date  date not null,
  rating        smallint not null check (rating between 1 and 5),
  comment       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (program_id, athlete_id, feeling_date)
);
create index if not exists program_day_feelings_program_idx
  on public.program_day_feelings (program_id, feeling_date);

alter table public.program_day_feelings enable row level security;

-- Lecture : l'athlète lui-même, ou le coach de la box du programme.
drop policy if exists "feelings_select" on public.program_day_feelings;
create policy "feelings_select" on public.program_day_feelings
  for select using (
    athlete_id = auth.uid()
    or public.is_box_coach(public.program_box_id_direct(program_id))
  );

-- Écriture : uniquement l'athlète, et uniquement sur SON programme.
drop policy if exists "feelings_insert" on public.program_day_feelings;
create policy "feelings_insert" on public.program_day_feelings
  for insert with check (
    athlete_id = auth.uid()
    and exists (select 1 from public.programs p where p.id = program_id and p.athlete_id = auth.uid())
  );

drop policy if exists "feelings_update" on public.program_day_feelings;
create policy "feelings_update" on public.program_day_feelings
  for update using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());

drop policy if exists "feelings_delete" on public.program_day_feelings;
create policy "feelings_delete" on public.program_day_feelings
  for delete using (athlete_id = auth.uid());

grant select, insert, update, delete on public.program_day_feelings to authenticated;

-- ─── 3. create_cycle / duplicate_program avec is_optional ────────
create or replace function public.create_cycle(
  p_box_id       uuid,
  p_name         text,
  p_start_date   date,
  p_weeks        jsonb,
  p_athlete_ids  uuid[] default null,     -- null = tous les membres actifs (role 'member')
  p_status       text   default 'draft',  -- 'draft' (relu avant publication) ou 'active'
  p_created_by   uuid   default null      -- requis hors app (SQL Editor)
)
returns table (out_program_id uuid, out_athlete_id uuid, out_athlete_name text)
language plpgsql
as $$
declare
  v_creator   uuid := coalesce(auth.uid(), p_created_by);
  v_athletes  uuid[];
  v_athlete   uuid;
  v_program   uuid;
  v_week_el   jsonb;
  v_sess_el   jsonb;
  v_block_el  jsonb;
  v_week      uuid;
  v_session   uuid;
  v_week_no   int;
  v_repeat    int;
  v_r         int;
  v_pos       int;
  v_ex_id     uuid;
  v_ex_name   text;
begin
  if v_creator is null then
    raise exception 'create_cycle: p_created_by est requis hors application (auth.uid() est null)';
  end if;
  if p_status not in ('draft', 'active') then
    raise exception 'create_cycle: p_status doit valoir draft ou active (reçu : %)', p_status;
  end if;
  if p_weeks is null or jsonb_typeof(p_weeks) <> 'array' or jsonb_array_length(p_weeks) = 0 then
    raise exception 'create_cycle: p_weeks doit être un tableau JSON non vide';
  end if;
  if p_start_date is null or extract(isodow from p_start_date) <> 1 then
    raise exception 'create_cycle: p_start_date doit être un lundi (reçu : %)', p_start_date;
  end if;

  -- Athlètes ciblés : liste explicite, sinon tous les membres actifs de la box.
  if p_athlete_ids is null then
    select coalesce(array_agg(bm.user_id order by bm.joined_at), '{}')
      into v_athletes
      from public.box_members bm
     where bm.box_id = p_box_id and bm.status = 'active' and bm.role = 'member';
  else
    v_athletes := p_athlete_ids;
  end if;

  if coalesce(array_length(v_athletes, 1), 0) = 0 then
    raise exception 'create_cycle: aucun athlète ciblé dans la box %', p_box_id;
  end if;

  foreach v_athlete in array v_athletes loop
    if not exists (
      select 1 from public.box_members bm
       where bm.box_id = p_box_id and bm.user_id = v_athlete and bm.status = 'active'
    ) then
      raise exception 'create_cycle: % n''est pas un membre actif de la box %', v_athlete, p_box_id;
    end if;

    insert into public.programs (box_id, athlete_id, created_by, name, start_date, status)
    values (p_box_id, v_athlete, v_creator, p_name, p_start_date, p_status)
    returning id into v_program;

    v_week_no := 0;

    for v_week_el in select * from jsonb_array_elements(p_weeks) loop
      -- "repeat": N → la même semaine type est dupliquée N fois (semaines consécutives).
      v_repeat := coalesce((v_week_el ->> 'repeat')::int, 1);
      if v_repeat < 1 then
        raise exception 'create_cycle: repeat doit être >= 1';
      end if;

      for v_r in 1..v_repeat loop
        v_week_no := v_week_no + 1;

        insert into public.program_weeks (program_id, week_number, label)
        values (v_program, v_week_no, v_week_el ->> 'label')
        returning id into v_week;

        for v_sess_el in select * from jsonb_array_elements(coalesce(v_week_el -> 'sessions', '[]'::jsonb)) loop
          insert into public.program_sessions (program_week_id, day_offset, period)
          values (
            v_week,
            (v_sess_el ->> 'day')::int,
            coalesce(v_sess_el ->> 'period', 'unique')
          )
          returning id into v_session;

          v_pos := 0;
          for v_block_el in select * from jsonb_array_elements(coalesce(v_sess_el -> 'blocks', '[]'::jsonb)) loop
            -- Exercice lié : par id explicite, sinon par nom (défauts partagés ou perso du créateur).
            v_ex_id := nullif(v_block_el ->> 'exercise_id', '')::uuid;
            v_ex_name := nullif(v_block_el ->> 'exercise', '');
            if v_ex_id is null and v_ex_name is not null then
              select pe.id into v_ex_id
                from public.personal_exercises pe
               where lower(pe.name) = lower(v_ex_name)
                 and (pe.is_default or pe.owner_id = v_creator)
               order by pe.is_default desc
               limit 1;
              if v_ex_id is null then
                raise warning 'create_cycle: exercice "%" introuvable dans le catalogue (bloc "%" créé sans lien)',
                  v_ex_name, v_block_el ->> 'title';
              end if;
            end if;

            insert into public.program_blocks
              (program_session_id, position, title, prescription, exercise_id,
               video_url, notes, percent_1rm, block_type, is_optional)
            values (
              v_session,
              v_pos,
              v_block_el ->> 'title',
              nullif(v_block_el ->> 'prescription', ''),
              v_ex_id,
              nullif(v_block_el ->> 'video_url', ''),
              nullif(v_block_el ->> 'notes', ''),
              nullif(v_block_el ->> 'percent_1rm', '')::numeric,
              coalesce(v_block_el ->> 'block_type', 'exercise'),
              coalesce((v_block_el ->> 'is_optional')::boolean, false)
            );
            v_pos := v_pos + 1;
          end loop;
        end loop;
      end loop;
    end loop;

    out_program_id   := v_program;
    out_athlete_id   := v_athlete;
    out_athlete_name := (select pr.full_name from public.profiles pr where pr.id = v_athlete);
    return next;
  end loop;
end;
$$;


-- ─── Duplication d'un programme existant vers 1..N athlètes ─────
-- Copie semaines / séances / blocs (block_type inclus), jamais les logs.
-- Les copies sont créées en brouillon, comme duplicateToAthlete côté JS.
create or replace function public.duplicate_program(
  p_source_program_id  uuid,
  p_athlete_ids        uuid[] default null,  -- null = tous les membres actifs de la box
  p_start_date         date   default null,  -- null = start_date du programme source
  p_name               text   default null,  -- null = nom du programme source
  p_created_by         uuid   default null
)
returns table (out_program_id uuid, out_athlete_id uuid, out_athlete_name text)
language plpgsql
as $$
declare
  v_creator   uuid := coalesce(auth.uid(), p_created_by);
  v_src       public.programs%rowtype;
  v_athletes  uuid[];
  v_athlete   uuid;
  v_program   uuid;
  v_week      record;
  v_session   record;
  v_new_week  uuid;
  v_new_sess  uuid;
begin
  if v_creator is null then
    raise exception 'duplicate_program: p_created_by est requis hors application (auth.uid() est null)';
  end if;

  select * into v_src from public.programs where id = p_source_program_id;
  if not found then
    raise exception 'duplicate_program: programme % introuvable (ou non visible)', p_source_program_id;
  end if;

  if p_start_date is not null and extract(isodow from p_start_date) <> 1 then
    raise exception 'duplicate_program: p_start_date doit être un lundi (reçu : %)', p_start_date;
  end if;

  if p_athlete_ids is null then
    select coalesce(array_agg(bm.user_id order by bm.joined_at), '{}')
      into v_athletes
      from public.box_members bm
     where bm.box_id = v_src.box_id and bm.status = 'active' and bm.role = 'member'
       and bm.user_id <> v_src.athlete_id;
  else
    v_athletes := p_athlete_ids;
  end if;

  if coalesce(array_length(v_athletes, 1), 0) = 0 then
    raise exception 'duplicate_program: aucun athlète cible';
  end if;

  foreach v_athlete in array v_athletes loop
    if not exists (
      select 1 from public.box_members bm
       where bm.box_id = v_src.box_id and bm.user_id = v_athlete and bm.status = 'active'
    ) then
      raise exception 'duplicate_program: % n''est pas un membre actif de la box', v_athlete;
    end if;

    insert into public.programs (box_id, athlete_id, created_by, name, start_date, status)
    values (v_src.box_id, v_athlete, v_creator,
            coalesce(p_name, v_src.name), coalesce(p_start_date, v_src.start_date), 'draft')
    returning id into v_program;

    for v_week in
      select * from public.program_weeks where program_id = v_src.id order by week_number
    loop
      insert into public.program_weeks (program_id, week_number, label)
      values (v_program, v_week.week_number, v_week.label)
      returning id into v_new_week;

      for v_session in
        select * from public.program_sessions where program_week_id = v_week.id
      loop
        insert into public.program_sessions (program_week_id, day_offset, period)
        values (v_new_week, v_session.day_offset, v_session.period)
        returning id into v_new_sess;

        insert into public.program_blocks
          (program_session_id, position, title, prescription, exercise_id,
           video_url, notes, percent_1rm, block_type, is_optional)
        select v_new_sess, pb.position, pb.title, pb.prescription, pb.exercise_id,
               pb.video_url, pb.notes, pb.percent_1rm, pb.block_type, pb.is_optional
          from public.program_blocks pb
         where pb.program_session_id = v_session.id;
      end loop;
    end loop;

    out_program_id   := v_program;
    out_athlete_id   := v_athlete;
    out_athlete_name := (select pr.full_name from public.profiles pr where pr.id = v_athlete);
    return next;
  end loop;
end;
$$;


-- ============================================================
-- FIN DE LA MIGRATION v12
-- ============================================================
