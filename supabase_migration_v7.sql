-- ============================================================
-- BOXLOG — Migration v7
-- Donne à un coach le droit de VOIR (jamais d'écrire) les PR d'un athlète,
-- mais uniquement s'ils partagent une box commune où ce coach a le rôle
-- 'coach' — jamais les PR d'un athlète d'une autre box. Un coach de la Box A
-- ne voit donc jamais les PR d'un athlète qui n'est que dans la Box B.
--
-- À exécuter après v2 à v6 (Supabase → SQL Editor → Run).
-- ============================================================

-- Vrai dès que l'utilisateur courant (auth.uid()) est coach actif d'au
-- moins une box où target_user_id est aussi membre actif.
create or replace function public.is_coach_of(target_user_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1
    from public.box_members coach_bm
    join public.box_members athlete_bm on athlete_bm.box_id = coach_bm.box_id
    where coach_bm.user_id = auth.uid()
      and coach_bm.role = 'coach'
      and coach_bm.status = 'active'
      and athlete_bm.user_id = target_user_id
      and athlete_bm.status = 'active'
  )
$$;

drop policy if exists "personal_records_own" on public.personal_records;

create policy "personal_records_select" on public.personal_records
  for select using (user_id = auth.uid() or public.is_coach_of(user_id));
-- Écriture : toujours réservée au propriétaire, jamais au coach (il regarde,
-- il ne modifie pas les PR de l'athlète à sa place).
create policy "personal_records_insert" on public.personal_records
  for insert with check (user_id = auth.uid());
create policy "personal_records_update" on public.personal_records
  for update using (user_id = auth.uid());
create policy "personal_records_delete" on public.personal_records
  for delete using (user_id = auth.uid());

-- Note : personal_records_latest (vue) a déjà security_invoker = on, donc
-- elle applique automatiquement cette nouvelle règle sans rien changer côté
-- vue elle-même.

-- ============================================================
-- FIN DE LA MIGRATION v7
-- ============================================================
