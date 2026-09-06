-- ============================================================
-- BOXLOG — Migration v8
-- À exécuter après v2 à v7 (Supabase → SQL Editor → Run)
--
-- Corrige la cause racine de l'erreur affichée sur l'onglet Programme
-- ("Could not find a relationship between 'box_members'/'programs' and
-- 'profiles' in the schema cache") ET un bug plus large et silencieux
-- présent partout ailleurs dans l'app (Ma box, scores de WOD, coach...) :
--
--   1. box_members.user_id et programs.athlete_id référencent
--      auth.users(id), jamais public.profiles(id) directement. PostgREST
--      ne peut donc pas faire d'embed automatique `profiles(...)` depuis
--      ces tables → erreur de schema cache (déjà corrigé côté code dans
--      usePrograms.js, qui fait maintenant 2 requêtes séparées comme le
--      reste de l'app).
--
--   2. Plus grave : la seule policy RLS sur profiles est
--      "profiles_select_own" (auth.uid() = id). Un membre ne peut donc lire
--      QUE son propre profil, jamais celui d'un coéquipier — même avec une
--      requête en 2 temps. C'est pour ça que les noms des autres membres
--      de la box (liste "Mon effectif", scores des autres sur un WOD, chat,
--      dashboard coach) tombent silencieusement sur le nom par défaut
--      ("Membre", "Athlète"...) au lieu du vrai prénom.
--
-- Cette migration ajoute une policy qui autorise à lire le profil de
-- quelqu'un avec qui on partage une box active (dans les deux sens : un
-- coach voit ses athlètes, un athlète voit son coach et ses coéquipiers).
-- ============================================================

create policy "profiles_select_boxmates" on public.profiles
  for select using (
    id in (
      select bm.user_id
      from public.box_members bm
      where bm.box_id in (select public.my_box_ids())
        and bm.status = 'active'
    )
  );

-- ============================================================
-- FIN DE LA MIGRATION v8
-- ============================================================
