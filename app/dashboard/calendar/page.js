'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useCurrentUser } from '../../../lib/hooks/useCurrentUser'
import { useBox } from '../../../lib/hooks/useBox'
import { useCalendarData } from '../../../lib/hooks/useCalendarData'
import { WOD_FORMAT_LABELS } from '../../../lib/constants'
import { localDateKey as toLocalKey } from '../../../lib/date'

// Grille du mois, semaines commençant le lundi. Renvoie un tableau de
// tableaux de 7 cases (null = case vide de padding avant/après le mois).
function buildMonthGrid(year, monthIndex) {
  const firstDay = new Date(year, monthIndex, 1)
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const leadingBlanks = (firstDay.getDay() + 6) % 7 // lundi = 0

  const cells = []
  for (let i = 0; i < leadingBlanks; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(year, monthIndex, day))
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export default function CalendarPage() {
  const { userId } = useCurrentUser({ redirectIfNull: true })
  const box = useBox()
  const cal = useCalendarData(box.activeBoxId, userId)
  const [selectedKey, setSelectedKey] = useState(() => toLocalKey(new Date()))

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

  if (box.loading) {
    return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>
  }

  const weeks = buildMonthGrid(cal.month.getFullYear(), cal.month.getMonth())
  const monthLabel = cal.month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const todayKey = toLocalKey(new Date())

  const selectedWod = wodsByDate[selectedKey] || null
  const selectedScore = selectedWod ? scoreByWodId[selectedWod.id] : null
  const hasNothingSelected = !selectedWod

  return (
    <div className="stack">
      <div>
        <div className="eyebrow">{box.activeBoxName}</div>
        <h1 className="h1">Calendrier</h1>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 14 }}>
          <button className="btn btnGhost btnSm" onClick={() => cal.goToMonth(-1)}>←</button>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{monthLabel}</span>
            {' '}
            <button className="btn btnGhost btnSm" onClick={cal.goToday} style={{ marginLeft: 8 }}>Aujourd’hui</button>
          </div>
          <button className="btn btnGhost btnSm" onClick={() => cal.goToMonth(1)}>→</button>
        </div>

        {cal.loading ? (
          <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
              {WEEKDAY_LABELS.map(d => (
                <div key={d} className="muted mono" style={{ fontSize: 11, textAlign: 'center' }}>{d}</div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {weeks.flat().map((date, i) => {
                if (!date) return <div key={i} />
                const key = toLocalKey(date)
                const hasWod = !!wodsByDate[key]
                const hasScore = hasWod && !!scoreByWodId[wodsByDate[key].id]
                const isToday = key === todayKey
                const isSelected = key === selectedKey

                return (
                  <button
                    key={key}
                    onClick={() => setSelectedKey(key)}
                    style={{
                      aspectRatio: '1',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 2,
                      borderRadius: 8,
                      border: isSelected ? '2px solid var(--accent, #ff6b35)' : isToday ? '1px solid var(--accent-brd, rgba(255,107,53,0.4))' : '1px solid transparent',
                      background: isSelected ? 'rgba(255,107,53,0.12)' : 'rgba(255,255,255,0.03)',
                      cursor: 'pointer',
                      color: 'inherit',
                      padding: 2,
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 400 }}>{date.getDate()}</span>
                    {hasWod && (
                      <span title="WOD" style={{ width: 5, height: 5, borderRadius: '50%', background: hasScore ? '#4ade80' : '#ff6b35' }} />
                    )}
                  </button>
                )
              })}
            </div>

            <div className="row" style={{ marginTop: 12, gap: 14, flexWrap: 'wrap', fontSize: 12 }}>
              <span className="muted"><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#ff6b35', marginRight: 4 }} />WOD (pas encore posté)</span>
              <span className="muted"><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#4ade80', marginRight: 4 }} />WOD (score posté)</span>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h3 className="eyebrow" style={{ marginBottom: 8 }}>
          {new Date(selectedKey + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}
        </h3>

        {hasNothingSelected && (
          <p className="muted">Rien de particulier ce jour-là.</p>
        )}

        {selectedWod && (
          <Link href={`/dashboard/wod/${selectedWod.id}`} className="card" style={{ borderColor: 'var(--accent-brd)' }}>
            <div className="row" style={{ marginBottom: 6 }}>
              <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: '#A9ADB8' }}>{WOD_FORMAT_LABELS[selectedWod.format]}</span>
              {selectedScore ? (
                <span className="badge badgeAccent">Score posté</span>
              ) : (
                <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: '#A9ADB8' }}>Pas encore posté</span>
              )}
            </div>
            <div style={{ fontWeight: 700 }}>{selectedWod.title}</div>
          </Link>
        )}
      </div>
    </div>
  )
}
