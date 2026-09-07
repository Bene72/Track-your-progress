'use client'
import { MUSCLE_GROUPS } from '../../lib/constants'

export const BLOCK_TYPES = [
  { value: 'straight_sets', label: 'Séries classiques', icon: '▤' },
  { value: 'superset', label: 'Superset', icon: '🔄' },
  { value: 'emom', label: 'EMOM', icon: '⏱' },
  { value: 'amrap', label: 'AMRAP', icon: '♾' },
  { value: 'for_time', label: 'For Time', icon: '🏁' },
]
export const BLOCK_TYPE_LABEL = Object.fromEntries(BLOCK_TYPES.map(b => [b.value, b.label]))
export const BLOCK_TYPE_ICON = Object.fromEntries(BLOCK_TYPES.map(b => [b.value, b.icon]))
export const ROUNDS_TYPES = new Set(['straight_sets', 'superset', 'emom', 'for_time'])
export const RESULT_TYPES = new Set(['amrap', 'for_time'])

export function blockSubtitle(block) {
  if (block.block_type === 'emom') return `EMOM ${block.rounds || '?'} (${block.interval_sec || 60}s/round)`
  if (block.block_type === 'amrap') return `AMRAP ${block.time_cap_sec ? Math.round(block.time_cap_sec / 60) + 'min' : ''}`
  if (block.block_type === 'for_time') return `${block.rounds || '?'} rounds for time`
  if (block.block_type === 'superset') return `Superset · ${block.rounds || '?'} rounds`
  return `${block.rounds || '?'} séries`
}

// Lettre du bloc (A/, B/, C/...) comme dans la programmation coach.
export function blockLetter(index) {
  return String.fromCharCode(65 + (index % 26))
}

// Ligne de prescription "façon CrossFit" (grosse ligne au-dessus des mouvements),
// dérivée des mêmes champs que blockSubtitle() mais formulée comme une consigne.
export function prescriptionLine(block) {
  if (block.block_type === 'emom') {
    const every = block.interval_sec ? `Every ${block.interval_sec}s` : 'Every round'
    return `${every} x ${block.rounds || '?'} rounds`
  }
  if (block.block_type === 'amrap') {
    return block.time_cap_sec ? `AMRAP ${Math.round(block.time_cap_sec / 60)}'` : 'AMRAP'
  }
  if (block.block_type === 'for_time') {
    const cap = block.time_cap_sec ? ` (cap ${Math.round(block.time_cap_sec / 60)}')` : ''
    return `For time${cap}`
  }
  if (block.block_type === 'superset') {
    return `${block.rounds || '?'} rounds`
  }
  return `${block.rounds || '?'} séries`
}

// Ligne de cible pour un mouvement, ex. "12 Burpee over the DB @2x22.5kg".
export function movementTargetLine(be) {
  const parts = []
  if (be.target_reps != null) parts.push(`${be.target_reps}`)
  parts.push(be.exercise?.name || '')
  const tail = []
  if (be.target_weight_kg) tail.push(`@${be.target_weight_kg}kg`)
  if (be.target_distance_m) tail.push(`${be.target_distance_m}m`)
  return { main: parts.filter(Boolean).join(' '), tail: tail.join(' ') }
}

export function normalizeText(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Groupe musculaire par défaut utilisé quand un exercice est créé "à la volée"
// depuis l'autocomplete (saisie libre, sans passer par le formulaire dédié
// "+ Exercice perso"). On retombe sur un groupe générique pour ne jamais
// bloquer l'ajout : l'utilisateur peut préciser/corriger la zone travaillée
// plus tard via le formulaire dédié s'il le souhaite.
export function defaultMuscleGroup() {
  const generic = MUSCLE_GROUPS.find(m => /autre|other|full/i.test(m.value) || /autre|other/i.test(m.label))
  return generic ? generic.value : MUSCLE_GROUPS[0].value
}
