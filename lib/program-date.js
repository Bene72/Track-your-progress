// Dates de programme = clés "YYYY-MM-DD" manipulées en UTC pur (aucune
// conversion de fuseau). L'ancienne version passait par un Date en heure
// LOCALE puis toISOString() (UTC) : en France (UTC+1/+2), minuit local tombe
// la veille en UTC, donc toutes les dates calculées côté client avaient un
// jour de retard (ex. "LUN 29" au lieu de "LUN 30" pour la semaine 3).
// Reproduit la formule de la vue SQL program_sessions_expanded
// (programs.start_date + (week_number-1)*7 + day_offset).
// day_offset : 0 = jour de start_date (lundi) ... 6 = dimanche.
const DAY_MS = 86400000

function parseKey(key) {
  const [y, m, d] = String(key).slice(0, 10).split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function formatKey(ms) {
  return new Date(ms).toISOString().slice(0, 10)
}

export function addDaysToKey(key, days) {
  return formatKey(parseKey(key) + days * DAY_MS)
}

export function computeSessionDate(startDateStr, weekNumber, dayOffset) {
  return addDaysToKey(startDateStr, (weekNumber - 1) * 7 + dayOffset)
}

// Inverse : à quelle semaine / quel jour du programme correspond une date ?
// null si la date est antérieure au début du programme.
export function locateDate(startDateStr, dateKey) {
  const diff = Math.round((parseKey(dateKey) - parseKey(startDateStr)) / DAY_MS)
  if (diff < 0) return null
  return { weekNumber: Math.floor(diff / 7) + 1, dayOffset: diff % 7 }
}

export const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export function formatSessionDateLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}
