-- ============================================================
-- BOXLOG — Migration v9
-- À exécuter après v2 à v8 (Supabase → SQL Editor → Run)
--
-- Corrige : "column personal_exercises_3.video_url does not exist" en
-- ouvrant un programme.
--
-- Cause : supabase_migration_v2.sql crée personal_exercises avec
-- `create table if not exists (...)`. Si cette table existait déjà chez toi
-- AVANT que video_url soit ajouté à cette définition (donc créée par un
-- tout premier passage de la migration, ou manuellement), le
-- "if not exists" a empêché toute recréation les fois suivantes → la
-- colonne video_url n'a jamais été ajoutée pour de vrai sur ta base, même
-- si le fichier .sql l'a "toujours" dans son texte.
--
-- Cette instruction est idempotente : sans effet si la colonne existe déjà.
-- ============================================================

alter table public.personal_exercises
  add column if not exists video_url text;

-- ============================================================
-- FIN DE LA MIGRATION v9
-- ============================================================
