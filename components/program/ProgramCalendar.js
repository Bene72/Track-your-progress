'use client'
import { useState, useMemo, useEffect } from 'react'
import { localDateKey } from '../../lib/date'
import { locateDate } from '../../lib/program-date'
import { sessionProgress } from '../../lib/program-progress'

// Calendrier mensuel d'un programme, même présentation que le calendrier des
// WODs (app/dashboard/calendar/page.js) : grille lundi→dimanche, un point de
// couleur par séance, jour sélectionné encadré.
//   - orange : séance à faire (ou en cours)
//   - vert   : tous les blocs de la séance sont faits
//   - gris   : séance vide (aucun bloc encore)
// Les jours qui font partie du programme ont un fond plus marqué, et le
// premier jour de chaque semaine porte un repère "S1", "S2"...

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const COLOR_TODO = '#ff6b35'
const COLOR_DONE = '#4ade80'
const COLOR_EMPTY = 'rgba(255,255,255,0.35)'

// Renvoie des semaines de 7 cases (null = padding avant/après le mois).
function buildMonthGrid(year, monthIndex) {
  const firstDay = new Date(year, monthIndex, 1)
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const leadingBlanks = (firstDay.getDay() + 6) % 7 // lundi = 0

  const cells = []
  for (let i = 0; i < leadingBlanks; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, monthIndex, day))
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

function monthOf(key) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1)
}

// bare : sans le cadre .card (quand le calendrier est affiché dans une fenêtre du bas).
export default function ProgramCalendar({ startDate, weeks, athleteId, selectedKey, onSelect, bare = false }) {
  const [month, setMonth] = useState(() => monthOf(selectedKey || startDate))

  // Quand la sélection change (ex. "Aujourd'hui"), on affiche son mois.
  useEffect(() => {
    if (selectedKey) setMonth(monthOf(selectedKey))
  }, [selectedKey])

  const weekNumbers = useMemo(() => new Set(weeks.map(w => w.week_number)), [weeks])

  // date → [{ total, done }] (une entrée par séance du jour : AM / PM / unique)
  const sessionsByDate = useMemo(() => {
    const map = {}
    for (const w of weeks) {
      for (const s of w.sessions || []) {
        ;(map[s.session_date] = map[s.session_date] || []).push(sessionProgress(s, athleteId))
      }
    }
    return map
  }, [weeks, athleteId])

  const grid = buildMonthGrid(month.getFullYear(), month.getMonth())
  const monthLabel = month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const todayKey = localDateKey(new Date())

  const goToMonth = (delta) => setMonth(m => new Date(m.getFullYear(), m.getMonth() + delta, 1))
  const goToday = () => {
    setMonth(monthOf(todayKey))
    onSelect(todayKey)
  }

  return (
    <div className={bare ? '' : 'card'}>
      <div className="row" style={{ marginBottom: 14 }}>
        <button type="button" className="btn btnGhost btnSm" onClick={() => goToMonth(-1)} aria-label="Mois précédent">←</button>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{monthLabel}</span>
          {' '}
          <button type="button" className="btn btnGhost btnSm" onClick={goToday} style={{ marginLeft: 8 }}>Aujourd’hui</button>
        </div>
        <button type="button" className="btn btnGhost btnSm" onClick={() => goToMonth(1)} aria-label="Mois suivant">→</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
        {WEEKDAY_LABELS.map(d => (
          <div key={d} className="muted mono" style={{ fontSize: 11, textAlign: 'center' }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {grid.flat().map((date, i) => {
          if (!date) return <div key={i} />
          const key = localDateKey(date)
          const loc = locateDate(startDate, key)
          const inProgram = !!loc && weekNumbers.has(loc.weekNumber)
          const isWeekStart = inProgram && loc.dayOffset === 0
          const isToday = key === todayKey
          const isSelected = key === selectedKey
          const sessions = sessionsByDate[key] || []

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              style={{
                position: 'relative',
                aspectRatio: '1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                borderRadius: 8,
                border: isSelected ? '2px solid var(--accent, #ff6b35)' : isToday ? '1px solid var(--accent-brd, rgba(255,107,53,0.4))' : '1px solid transparent',
                background: isSelected ? 'rgba(255,107,53,0.12)' : inProgram ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                opacity: inProgram || isSelected ? 1 : 0.55,
                cursor: 'pointer',
                color: 'inherit',
                padding: 2,
              }}
            >
              {isWeekStart && (
                <span style={{ position: 'absolute', top: 2, left: 4, fontSize: 8, fontWeight: 800, color: 'var(--accent, #ff6b35)' }}>
                  S{loc.weekNumber}
                </span>
              )}
              <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 400 }}>{date.getDate()}</span>
              {sessions.length > 0 && (
                <span style={{ display: 'flex', gap: 2 }}>
                  {sessions.map((s, idx) => (
                    <span
                      key={idx}
                      style={{
                        width: 4, height: 4, borderRadius: '50%',
                        background: s.total === 0 ? COLOR_EMPTY : s.done >= s.total ? COLOR_DONE : COLOR_TODO,
                      }}
                    />
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="row" style={{ marginTop: 12, gap: 14, flexWrap: 'wrap', fontSize: 12 }}>
        <span className="muted"><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: COLOR_TODO, marginRight: 4 }} />À faire</span>
        <span className="muted"><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: COLOR_DONE, marginRight: 4 }} />Fait</span>
        <span className="muted"><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: COLOR_EMPTY, marginRight: 4 }} />Séance vide</span>
      </div>
    </div>
  )
}
