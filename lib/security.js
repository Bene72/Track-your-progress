// lib/security.js
import { z } from 'zod'

export function sanitizeText(input, maxLength = 1000) {
  return String(input ?? '')
    .replace(/[<>`\\]/g, '')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .trim()
    .slice(0, maxLength)
}

export function sanitizeInt(value, min = 0, max = 999999) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < min || n > max) return null
  return Math.round(n)
}

export function sanitizeFloat(value, min = 0, max = 999999) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < min || n > max) return null
  return Math.round(n * 100) / 100
}

// ─── Schemas ───────────────────────────────────────────────
export const wodSchema = z.object({
  title: z.string().trim().min(2).max(120),
  format: z.enum(['for_time', 'amrap', 'emom', 'strength', 'custom']),
  description: z.string().trim().min(2).max(3000),
  scoring_type: z.enum(['time', 'rounds_reps', 'load', 'reps', 'none']),
  wod_date: z.string(),
  time_cap_sec: z.number().int().min(0).max(21600).nullable().optional(),
  emom_interval_sec: z.number().int().min(0).max(3600).nullable().optional(),
  emom_rounds: z.number().int().min(0).max(200).nullable().optional(),
  is_benchmark: z.boolean().optional(),
})

export const scoreSchema = z.object({
  rx: z.boolean(),
  time_seconds: z.number().int().min(0).max(86400).nullable().optional(),
  rounds: z.number().int().min(0).max(999).nullable().optional(),
  extra_reps: z.number().int().min(0).max(9999).nullable().optional(),
  load_kg: z.number().min(0).max(999).nullable().optional(),
  reps: z.number().int().min(0).max(99999).nullable().optional(),
  notes: z.string().trim().max(500).optional(),
})

export const prSchema = z.object({
  movement: z.string().trim().min(1).max(80),
  value_type: z.enum(['weight', 'time', 'reps']),
  value_number: z.number().min(0).max(99999),
  achieved_at: z.string(),
  notes: z.string().trim().max(500).optional(),
})

export const boxNameSchema = z.string().trim().min(2).max(60)

// Politique de mot de passe côté client (UX + garde-fou minimal).
// La vraie application des règles reste côté Supabase Auth : pense à
// activer "Leaked password protection" et un minimum de 8 caractères
// dans Dashboard → Authentication → Policies, ce fichier ne peut pas
// le forcer côté serveur.
export const passwordSchema = z
  .string()
  .min(8, 'Au moins 8 caractères')
  .regex(/[a-zA-Z]/, 'Au moins une lettre')
  .regex(/[0-9]/, 'Au moins un chiffre')

export function passwordStrength(pw) {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^a-zA-Z0-9]/.test(pw)) score++
  if (score <= 2) return 'faible'
  if (score <= 3) return 'moyen'
  return 'fort'
}
