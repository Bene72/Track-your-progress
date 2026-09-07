-- ============================================================
-- BOXLOG — Migration v6
-- Ajoute un champ structuré "% du 1RM" sur les blocs de programme, en plus
-- du texte libre "prescription" existant. Quand il est renseigné ET que le
-- bloc est lié à un mouvement du catalogue, l'app calcule automatiquement
-- la charge de travail à partir du dernier PR (poids) de l'athlète sur ce
-- mouvement (table personal_records, déjà existante).
--
-- À exécuter après v2 à v5 (Supabase → SQL Editor → Run).
-- ============================================================

alter table public.program_blocks
  add column if not exists percent_1rm numeric(5,2) check (percent_1rm is null or (percent_1rm > 0 and percent_1rm <= 200));

-- ============================================================
-- FIN DE LA MIGRATION v6
-- ============================================================
