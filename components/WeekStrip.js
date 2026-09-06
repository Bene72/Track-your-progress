'use client'
import { useMemo } from 'react'
import { localDateKey as toLocalKey } from '../lib/date'

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

function startOfWeek(date) {
  const d = new Date(date)
  const diff = (d.getDay() + 6) % 7 // lundi = 0
  d.setDate(d.getDate() - diff)
  return d
}

// Bandeau "semaine en cours" avec un point par pilier actif ce jour-là
// (WOD / Perso / Programme), filtré par les préférences "Mes groupes".
// Volontairement limité à la semaine courante (pas de navigation) — pour
// une vue mois complète avec navigation, /dashboard/calendar existe déjà.
export default function WeekStrip({ cal, prefs, selectedKey, onSelect }) {
  const week = useMemo(() => {
    const start = startOfWeek(new Date())
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [])

  const wodsByDate = useMemo(() => {
    const map = {}
    for (const w of cal.wods) map[w.wod_date] = w
    return map
  }, [cal.wods])
  const scoreByWodId = useMemo(() => {
    const map = {}
    for (const s of cal.myScores) map[s.wod_id] = s
    return map
  }, [cal.myScores])
  const sessionsByDate = useMemo(() => {
    const map = {}
    for (const s of cal.sessions) map[s.session_date] = s
    return map
  }, [cal.sessions])
  const programDaysByDate = useMemo(() => {
    const map = {}
    for (const p of cal.programDays) {
      map[p.date] = map[p.date] || []
      map[p.date].push(p)
    }
    return map
  }, [cal.programDays])

  const todayKey = toLocalKey(new Date())
  const monthLabel = MONTH_NAMES[new Date().getMonth()]

  return (
    <div className="weekBand">
      <div className="monthLabel">{monthLabel}</div>
      <div className="weekStrip">
        {week.map((date, i) => {
          const key = toLocalKey(date)
          const isToday = key === todayKey
          const isSelected = key === selectedKey

          const hasWod = prefs.isVisible('wod') && !!wodsByDate[key]
          const hasScore = hasWod && !!scoreByWodId[wodsByDate[key].id]
          const hasPerso = prefs.isVisible('perso') && !!sessionsByDate[key]
          const progDaysToday = (programDaysByDate[key] || []).filter(p => prefs.isVisible(`program:${p.programId}`))

          return (
            <button
              key={key}
              type="button"
              className={`dayCell ${isToday ? 'dayCellToday' : ''} ${isSelected && !isToday ? 'dayCellSelected' : ''}`}
              onClick={() => onSelect(key)}
            >
              <span className="dayName">{DAY_NAMES[i]}</span>
              <span className="dayNum">{date.getDate()}</span>
              <span className="dayDots">
                {hasWod && <span className="dot" style={{ background: hasScore ? 'var(--rx)' : 'var(--accent)' }} />}
                {hasPerso && <span className="dot" style={{ background: 'var(--gold)' }} />}
                {progDaysToday.map(p => (
                  <span key={p.programId} className="dot" style={{ background: p.done >= p.total && p.total > 0 ? 'var(--rx)' : 'var(--accent)' }} />
                ))}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
