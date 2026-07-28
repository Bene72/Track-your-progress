// lib/security.js
import { z } from 'zod'

export function sanitizeText(input, maxLength = 1000) {
  return String(input ?? '')
    .replace(/[<>`\\]/g, '')
    // On garde \t (\x09), \n (\x0A) et \r (\x0D) : ce sont des caractères
    // de mise en forme légitimes (multi-lignes), pas une menace en soi.
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    // Normalise les retours à la ligne Windows (\r\n) et Mac classiques (\r)
    // vers \n, pour un stockage/affichage cohérent.
    .replace(/\r\n?/g, '\n')
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

export const passwordSchema = z.string().min(6, 'Au moins 6 caractères')
