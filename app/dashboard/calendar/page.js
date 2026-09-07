'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useCurrentUser } from '../../../lib/hooks/useCurrentUser'
import { useBox } from '../../../lib/hooks/useBox'
import { useCalendarData } from '../../../lib/hooks/useCalendarData'
import { useProgramsList } from '../../../lib/hooks/usePrograms'
import { useGroupPrefs } from '../../../lib/hooks/useGroupPrefs'
import { WOD_FORMAT_LABELS } from '../../../lib/constants'
import { localDateKey as toLocalKey } from '../../../lib/date'
import GroupsSheet from '../../../components/GroupsSheet'

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
  const { myPrograms } = useProgramsList({ userId, boxId: box.activeBoxId, isCoach: box.isCoach })
  const prefs = useGroupPrefs(userId)
  const [showGroups, setShowGroups] = useState(false)
  const [selectedKey, setSelectedKey] = useState(() => toLocalKey(new Date()))

  const wodsByDate = useMemo(() => {
    const map = {}
    if (!prefs.isVisible('wod')) return map
    for (const w of cal.wods) map[w.wod_date] = w
    return map
  }, [cal.wods, prefs])

  const scoreByWodId = useMemo(() => {
    const map = {}
    for (const s of cal.myScores) map[s.wod_id] = s
    return map
  }, [cal.myScores])

  const sessionsByDate = useMemo(() => {
    const map = {}
    if (!prefs.isVisible('perso')) return map
    for (const s of cal.sessions) map[s.session_date] = s
    return map
  }, [cal.sessions, prefs])

  const programByDate = useMemo(() => {
    const map = {}
    for (const p of cal.programDays) {
      if (!prefs.isVisible(`program:${p.programId}`)) continue
      map[p.date] = p
    }
    return map
  }, [cal.programDays, prefs])

  if (box.loading) {
    return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>
  }

  const weeks = buildMonthGrid(cal.month.getFullYear(), cal.month.getMonth())
  const monthLabel = cal.month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const todayKey = toLocalKey(new Date())

  const selectedWod = wodsByDate[selectedKey] || null
  const selectedScore = selectedWod ? scoreByWodId[selectedWod.id] : null
  const selectedSession = sessionsByDate[selectedKey] || null
  const selectedProgramDay = programByDate[selectedKey] || null
  const hasNothingSelected = !selectedWod && !selectedSession && !selectedProgramDay

  return (
    <div className="stack">
      <div>
        <div className="eyebrow">{box.activeBoxName}</div>
        <h1 className="h1">Calendrier</h1>
      </div>

      <button type="button" className="groupsBtn" onClick={() => setShowGroups(true)}>
        <span>📂 Mes groupes affichés</span>
        <span className="muted">›</span>
      </button>

      <GroupsSheet open={showGroups} onClose={() => setShowGroups(false)} myPrograms={myPrograms} prefs={prefs} />

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
                const hasPerso = !!sessionsByDate[key]
                const progDay = programByDate[key]
                const isToday = key === todayKey
                const isSelected = key === selectedKey

                // Un pilier peut être : absent (pas de point), en cours
                // (point orange) ou fait (point vert).
                const dots = [
                  hasWod ? (hasScore ? '#4ade80' : '#ff6b35') : null,
                  hasPerso ? '#E8B347' : null,
                  progDay ? (progDay.done >= progDay.total && progDay.total > 0 ? '#4ade80' : '#ff6b35') : null,
                ].filter(Boolean)

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
                      gap: 3,
                      borderRadius: 8,
                      border: isSelected ? '2px solid var(--accent, #ff6b35)' : isToday ? '1px solid var(--accent-brd, rgba(255,107,53,0.4))' : '1px solid transparent',
                      background: isSelected ? 'rgba(255,107,53,0.12)' : 'rgba(255,255,255,0.03)',
                      cursor: 'pointer',
                      color: 'inherit',
                      padding: 2,
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 400 }}>{date.getDate()}</span>
                    {dots.length > 0 && (
                      <span style={{ display: 'flex', gap: 2 }}>
                        {dots.map((color, i) => (
                          <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: color }} />
                        ))}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="row" style={{ marginTop: 12, gap: 14, flexWrap: 'wrap', fontSize: 12 }}>
              <span className="muted"><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#ff6b35', marginRight: 4 }} />En attente</span>
              <span className="muted"><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#4ade80', marginRight: 4 }} />Fait</span>
              <span className="muted"><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#E8B347', marginRight: 4 }} />Perso loguée</span>
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

        <div className="stack" style={{ gap: 8 }}>
          {selectedWod && (
            <Link href={`/dashboard/wod/${selectedWod.id}`} className="pillarRow">
              <span className="pillarIcon pillarIconWod">🏋️</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{selectedWod.title}</div>
                <div className="muted" style={{ fontSize: 11 }}>WOD de box — {WOD_FORMAT_LABELS[selectedWod.format]}</div>
              </div>
              <span className={`pillarCheck ${selectedScore ? 'pillarCheckDone' : ''}`}>{selectedScore ? '✓' : ''}</span>
            </Link>
          )}

          {selectedSession && (
            <Link href="/dashboard/perso" className="pillarRow">
              <span className="pillarIcon pillarIconPerso">📓</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Séance perso</div>
                <div className="muted" style={{ fontSize: 11 }}>Loguée ce jour-là</div>
              </div>
              <span className="pillarCheck pillarCheckDone">✓</span>
            </Link>
          )}

          {selectedProgramDay && (
            <Link href={`/dashboard/programme/${selectedProgramDay.programId}`} className="pillarRow">
              <span className="pillarIcon pillarIconProgramme">📋</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Programme</div>
                <div className="muted" style={{ fontSize: 11 }}>{selectedProgramDay.done}/{selectedProgramDay.total} bloc{selectedProgramDay.total !== 1 ? 's' : ''} fait{selectedProgramDay.done !== 1 ? 's' : ''}</div>
              </div>
              <span className={`pillarCheck ${selectedProgramDay.done >= selectedProgramDay.total && selectedProgramDay.total > 0 ? 'pillarCheckDone' : ''}`}>
                {selectedProgramDay.done >= selectedProgramDay.total && selectedProgramDay.total > 0 ? '✓' : ''}
              </span>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
