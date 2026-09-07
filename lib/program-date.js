// Reproduit côté client la formule de la vue SQL program_sessions_expanded
// (programs.start_date + (week_number-1)*7 + day_offset), pour afficher une
// date immédiatement après création sans attendre un aller-retour réseau.
// day_offset : 0 = lundi ... 6 = dimanche.
export function computeSessionDate(startDateStr, weekNumber, dayOffset) {
  const start = new Date(`${startDateStr}T00:00:00`)
  const totalDays = (weekNumber - 1) * 7 + dayOffset
  const result = new Date(start)
  result.setDate(result.getDate() + totalDays)
  return result.toISOString().slice(0, 10)
}

export const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export function formatSessionDateLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}
