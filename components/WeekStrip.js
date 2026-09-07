'use client'
import { useMemo, useState, useRef, useEffect } from 'react'
import { localDateKey as toLocalKey } from '../lib/date'

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]
const SWIPE_THRESHOLD = 40 // px

function startOfWeek(date) {
  const d = new Date(date)
  const diff = (d.getDay() + 6) % 7 // lundi = 0
  d.setDate(d.getDate() - diff)
  return d
}

// Bandeau semaine — swipe tactile sur tel, et glisser-cliquer à la souris
// sur PC (même geste, juste déclenché par mousedown/mouseup au lieu de
// touchstart/touchend). Pas de flèches. On ne bloque jamais l'affichage
// même en cas de souci de chargement pour une semaine lointaine : les
// points colorés disparaissent simplement s'il n'y a rien à montrer,
// jamais de message d'erreur.
export default function WeekStrip({ cal, prefs, selectedKey, onSelect }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef(null) // { x, y }
  const didSwipe = useRef(false)

  const today = useMemo(() => new Date(), [])
  const week = useMemo(() => {
    const s = startOfWeek(today)
    s.setDate(s.getDate() + weekOffset * 7)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(s)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [today, weekOffset])

  // Recharge cal.month si la semaine affichée sort du mois déjà chargé —
  // on regarde le jeudi (milieu de semaine) pour trancher côté du mois
  // majoritaire quand la semaine est à cheval sur deux mois. Protégé : si
  // jamais cal.goToDate n'est pas dispo (ancien build en cache) ou que le
  // chargement échoue pour une semaine très lointaine, on ne casse jamais
  // le rendu — au pire les points restent ceux du mois précédent un instant.
  useEffect(() => {
    try {
      const pivot = week[3]
      if (typeof cal?.goToDate !== 'function') return
      if (pivot.getFullYear() !== cal.month?.getFullYear() || pivot.getMonth() !== cal.month?.getMonth()) {
        cal.goToDate(pivot)
      }
    } catch {
      // silencieux : on préfère un bandeau sans points à un écran cassé
    }
  }, [week, cal])

  const goToWeek = (newOffset) => {
    setWeekOffset(newOffset)
    const s = startOfWeek(today)
    s.setDate(s.getDate() + newOffset * 7)
    onSelect(toLocalKey(newOffset === 0 ? today : s))
  }

  const handleDragStart = (x, y) => {
    start.current = { x, y }
    didSwipe.current = false
    setDragging(true)
  }

  const handleDragEnd = (x, y) => {
    if (!start.current) return
    const deltaX = x - start.current.x
    const deltaY = y - start.current.y
    start.current = null
    setDragging(false)
    // Ignore si le mouvement est surtout vertical (scroll de page au doigt).
    if (Math.abs(deltaX) < Math.abs(deltaY)) return
    if (deltaX > SWIPE_THRESHOLD) { didSwipe.current = true; goToWeek(weekOffset - 1) }
    else if (deltaX < -SWIPE_THRESHOLD) { didSwipe.current = true; goToWeek(weekOffset + 1) }
  }

  // Souris (PC) : mousedown démarre le geste, mouseup n'importe où sur la
  // page le termine (au cas où le curseur sort du bandeau avant de relâcher).
  useEffect(() => {
    if (!dragging) return
    const onMouseUp = (e) => handleDragEnd(e.clientX, e.clientY)
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, weekOffset])

  const onTouchStart = (e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)
  const onTouchEnd = (e) => handleDragEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY)
  const onMouseDown = (e) => { e.preventDefault(); handleDragStart(e.clientX, e.clientY) }

  const onDayClick = (key) => {
    if (didSwipe.current) { didSwipe.current = false; return } // évite de sélectionner un jour juste après un swipe
    onSelect(key)
  }

  const wodsByDate = useMemo(() => {
    const map = {}
    for (const w of cal.wods || []) map[w.wod_date] = w
    return map
  }, [cal.wods])
  const scoreByWodId = useMemo(() => {
    const map = {}
    for (const s of cal.myScores || []) map[s.wod_id] = s
    return map
  }, [cal.myScores])
  const sessionsByDate = useMemo(() => {
    const map = {}
    for (const s of cal.sessions || []) map[s.session_date] = s
    return map
  }, [cal.sessions])
  const programDaysByDate = useMemo(() => {
    const map = {}
    for (const p of cal.programDays || []) {
      map[p.date] = map[p.date] || []
      map[p.date].push(p)
    }
    return map
  }, [cal.programDays])

  const todayKey = toLocalKey(today)
  const startMonth = MONTH_NAMES[week[0].getMonth()]
  const endMonth = MONTH_NAMES[week[6].getMonth()]
  const monthLabel = startMonth === endMonth ? startMonth : `${startMonth} – ${endMonth}`

  return (
    <div className="weekBand">
      <div className="weekBandHead">
        <span className="monthLabel">{monthLabel}</span>
        {weekOffset !== 0 && (
          <button type="button" className="weekTodayBtn" onClick={() => goToWeek(0)}>Aujourd&apos;hui</button>
        )}
      </div>

      <div
        className={`weekStrip ${dragging ? 'weekStripDragging' : ''}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
      >
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
              onClick={() => onDayClick(key)}
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
