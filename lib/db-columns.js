// lib/db-columns.js
//
// Colonnes explicites pour chaque requête Supabase, à la place de
// `select('*')` utilisé partout auparavant.
//
// Pourquoi : la RLS protège déjà le "qui peut lire quelle ligne", mais
// `select('*')` fait transiter côté client toute colonne existante ou
// future sur la table — y compris une colonne sensible ajoutée plus
// tard par erreur sans que personne n'ait pensé à l'exclure ici. Lister
// explicitement ce dont chaque écran a besoin :
//  - réduit la bande passante (notable sur mobile/PWA),
//  - documente l'intention de chaque requête,
//  - évite qu'un futur champ sensible ne se retrouve exposé par défaut.

export const WOD_COLUMNS =
  'id, box_id, created_by, wod_date, title, format, time_cap_sec, ' +
  'emom_interval_sec, emom_rounds, description, scoring_type, ' +
  'is_benchmark, status, video_url, created_at'

export const WOD_SCORE_COLUMNS =
  'id, wod_id, box_id, user_id, rx, time_seconds, rounds, extra_reps, ' +
  'load_kg, reps, notes, created_at'

export const PERSONAL_RECORD_COLUMNS =
  'id, user_id, session_id, movement, value_type, value_number, achieved_at, notes, created_at'

export const PERSONAL_SESSION_COLUMNS =
  'id, user_id, box_id, session_date, title, notes, created_at'

export const PROFILE_COLUMNS_MINIMAL = 'id, full_name'

export const BOX_MEMBER_COLUMNS = 'id, box_id, user_id, role, status, joined_at'

export const BOX_INVITE_COLUMNS =
  'id, box_id, code, created_by, role, active, expires_at, max_uses, uses_count, created_at'
