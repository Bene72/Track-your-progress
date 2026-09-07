// Types de bloc côté Programme — un coach pense "je fais un superset" ou
// "un EMOM", pas "j'ajoute un bloc générique". Purement un tag visuel pour
// l'instant (cf. supabase_migration_v10.sql) : chaque bloc reste
// mono-exercice, un superset = 2 blocs consécutifs tagués "superset".
export const BLOCK_TYPES = [
  { value: 'exercise', label: 'Exercice', icon: '🏋️', color: '#F97316' },
  { value: 'superset', label: 'Superset', icon: '🔗', color: '#60A5FA' },
  { value: 'circuit', label: 'Circuit', icon: '🔄', color: '#2DD4BF' },
  { value: 'emom', label: 'EMOM', icon: '⏱️', color: '#FBBF24' },
  { value: 'amrap', label: 'AMRAP', icon: '🔥', color: '#F87171' },
  { value: 'for_time', label: 'For Time', icon: '⏳', color: '#F87171' },
  { value: 'warmup', label: 'Warm-up', icon: '🔆', color: '#4ADE80' },
  { value: 'finisher', label: 'Finisher', icon: '💥', color: '#C084FC' },
  { value: 'note', label: 'Note', icon: '📝', color: '#9CA3AF' },
]

export const BLOCK_TYPE_BY_VALUE = Object.fromEntries(BLOCK_TYPES.map(t => [t.value, t]))

export function getBlockType(value) {
  return BLOCK_TYPE_BY_VALUE[value] || BLOCK_TYPES[0]
}
