-- ============================================================
-- BOXLOG — Migration v10
-- À exécuter après v2 à v9 (Supabase → SQL Editor → Run)
--
-- Ajoute une distinction Exercice / Superset / Circuit / EMOM / AMRAP /
-- For Time / Warm-up / Finisher / Note sur les blocs de programme, pour que
-- le coach pense "je fais un superset / un EMOM" plutôt que "j'ajoute un
-- bloc" générique (cf. retours UX). Même liste de valeurs que
-- personal_blocks.block_type côté Perso, étendue avec les catégories utiles
-- côté programmation coach (warmup / finisher / note).
--
-- Reste volontairement un simple tag visuel/organisationnel sur un bloc
-- toujours mono-exercice (pas de refonte du modèle de données vers des
-- groupes multi-exercices) : un superset se programme aujourd'hui comme 2
-- blocs consécutifs tagués "superset", pas comme une nouvelle entité.
-- ============================================================

alter table public.program_blocks
  add column if not exists block_type text not null default 'exercise'
    check (block_type in ('exercise','superset','circuit','emom','amrap','for_time','warmup','finisher','note'));

-- ============================================================
-- FIN DE LA MIGRATION v10
-- ============================================================
