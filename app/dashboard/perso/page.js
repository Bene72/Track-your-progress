'use client'
import { useState } from 'react'
// Adapte la profondeur des '../../../' si ta route n'est pas exactement
// app/dashboard/perso/page.js.
import { useCurrentUser } from '../../../lib/hooks/useCurrentUser'
import { usePersonalTraining } from '../../../lib/hooks/usePersonalTraining'
import PersonalSessionCard from '../../../components/PersonalSessionCard'
import WeeklyVolumeChart from '../../../components/WeeklyVolumeChart'

function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function PersonalTrainingPage() {
  const { userId } = useCurrentUser({ redirectIfNull: true })
  const pt = usePersonalTraining(userId)
  const [tab, setTab] = useState('add') // 'add' | 'bilan'
  const [creating, setCreating] = useState(false)

  if (pt.loading) {
    return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>
  }

  const dateLabel = new Date(pt.viewDate + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const isToday = pt.viewDate === new Date().toISOString().slice(0, 10)

  const handleCreate = async () => {
    setCreating(true)
    try { await pt.createSession() } finally { setCreating(false) }
  }

  return (
    <div className="stack">
      <div>
        <div className="eyebrow">Entrainement perso</div>
        <h1 className="h1">Mes séances</h1>
      </div>

      <div className="row" style={{ gap: 8 }}>
        <button className={tab === 'add' ? 'btn btnPrimary' : 'btn btnGhost'} style={{ flex: 1 }} onClick={() => setTab('add')}>
          Séances
        </button>
        <button className={tab === 'bilan' ? 'btn btnPrimary' : 'btn btnGhost'} style={{ flex: 1 }} onClick={() => setTab('bilan')}>
          Bilan volume
        </button>
      </div>

      {tab === 'add' ? (
        <>
          <div className="card row" style={{ gap: 8 }}>
            <button type="button" className="btn btnGhost btnSm" onClick={() => pt.changeDate(addDaysStr(pt.viewDate, -1))} aria-label="Jour précédent">←</button>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ textTransform: 'capitalize', fontWeight: 500 }}>{dateLabel}</div>
              <input
                type="date"
                value={pt.viewDate}
                onChange={e => pt.changeDate(e.target.value)}
                style={{ marginTop: 4, fontSize: 12, padding: '4px 8px', width: 'auto' }}
              />
            </div>
            <button type="button" className="btn btnGhost btnSm" onClick={() => pt.changeDate(addDaysStr(pt.viewDate, 1))} disabled={isToday && false} aria-label="Jour suivant">→</button>
          </div>

          {pt.sessions.map(session => (
            <PersonalSessionCard
              key={session.id}
              session={session}
              catalogByMuscle={pt.catalogByMuscle}
              onAddExercise={(exId) => pt.addExercise(session.id, exId)}
              onAddCustomExercise={pt.addCustomExercise}
              onAddSet={pt.addSet}
              onDeleteSet={pt.deleteSet}
              onDeleteExercise={pt.deleteSessionExercise}
            />
          ))}

          {pt.sessions.length === 0 && (
            <div className="card empty">
              <p>Aucune séance ce jour-là.</p>
            </div>
          )}

          <button type="button" className="btn btnGhost btnBlock" onClick={handleCreate} disabled={creating}>
            {creating ? '...' : '+ Nouvelle séance'}
          </button>
        </>
      ) : (
        <WeeklyVolumeChart volume={pt.weeklyVolume} />
      )}
    </div>
  )
}
