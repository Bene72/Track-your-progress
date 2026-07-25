// lib/constants.js

export const WOD_FORMATS = [
  { value: 'for_time', label: 'For Time' },
  { value: 'amrap', label: 'AMRAP' },
  { value: 'emom', label: 'EMOM' },
  { value: 'strength', label: 'Force / Charge max' },
  { value: 'custom', label: 'Autre' },
]

export const WOD_FORMAT_LABELS = Object.fromEntries(WOD_FORMATS.map(f => [f.value, f.label]))

// Type de score suggéré par format (mais modifiable)
export const DEFAULT_SCORING = {
  for_time: 'time',
  amrap: 'rounds_reps',
  emom: 'reps',
  strength: 'load',
  custom: 'none',
}

export const SCORING_TYPES = [
  { value: 'time', label: 'Temps' },
  { value: 'rounds_reps', label: 'Rounds + Reps' },
  { value: 'load', label: 'Charge (kg)' },
  { value: 'reps', label: 'Reps totales' },
  { value: 'none', label: 'Sans score chiffré' },
]

export const PR_VALUE_TYPES = [
  { value: 'weight', label: 'Charge (kg)' },
  { value: 'time', label: 'Temps' },
  { value: 'reps', label: 'Reps' },
]

export function formatSecondsToClock(totalSeconds) {
  if (totalSeconds == null || Number.isNaN(totalSeconds)) return '—'
  const m = Math.floor(totalSeconds / 60)
  const s = Math.round(totalSeconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function clockToSeconds(clockStr) {
  if (!clockStr) return null
  const parts = String(clockStr).split(':').map(Number)
  if (parts.some(Number.isNaN)) return null
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 1) return parts[0]
  return null
}

export function formatScore(score, wod) {
  if (!score) return '—'
  switch (wod?.scoring_type) {
    case 'time': return formatSecondsToClock(score.time_seconds)
    case 'rounds_reps': return `${score.rounds ?? 0} rounds + ${score.extra_reps ?? 0}`
    case 'load': return score.load_kg != null ? `${score.load_kg} kg` : '—'
    case 'reps': return score.reps != null ? `${score.reps} reps` : '—'
    default: return score.notes ? 'Complété' : '—'
  }
}
