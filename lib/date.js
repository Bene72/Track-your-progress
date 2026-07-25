// Convertit une Date en clé YYYY-MM-DD en HEURE LOCALE (pas UTC).
// Évite que le champ "Date" soit décalé entre minuit et ~2h du matin
// heure de Paris (toISOString() bascule sur UTC et casse ça).
//
// Auparavant dupliqué à l'identique dans 4 fichiers (useWodData,
// useCalendarData, wod/new/page, calendar/page) — source unique ici.
export function localDateKey(d = new Date()) {
  const offset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - offset).toISOString().slice(0, 10)
}

export function todayKey() {
  return localDateKey(new Date())
}
