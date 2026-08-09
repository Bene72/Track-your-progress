'use client'
import { useState } from 'react'
// Adapte la profondeur des '../../../' si ta route n'est pas exactement
// app/dashboard/perso/page.js (même logique que app/dashboard/page.js existant).
import { useCurrentUser } from '../../../lib/hooks/useCurrentUser'
import { usePersonalTraining } from '../../../lib/hooks/usePersonalTraining'
import PersonalSessionForm from '../../../components/PersonalSessionForm'
import WeeklyVolumeChart from '../../../components/WeeklyVolumeChart'

export default function PersonalTrainingPage() {
  const { userId } = useCurrentUser({ redirectIfNull: true })
  const pt = usePersonalTraining(userId)
  const [tab, setTab] = useState('add') // 'add' | 'bilan'

  if (pt.loading) {
    return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>
  }

  return (
    <div className="stack">
      <div>
        <div className="eyebrow">Entrainement perso</div>
        <h1 className="h1">Ma séance</h1>
      </div>

      <div className="row" style={{ gap: 8 }}>
        <button className={tab === 'add' ? 'btn btnPrimary' : 'btn btnGhost'} style={{ flex: 1 }} onClick={() => setTab('add')}>
          Ajouter séance
        </button>
        <button className={tab === 'bilan' ? 'btn btnPrimary' : 'btn btnGhost'} style={{ flex: 1 }} onClick={() => setTab('bilan')}>
          Bilan volume
        </button>
      </div>

      {tab === 'add' ? (
        <PersonalSessionForm
          catalogByMuscle={pt.catalogByMuscle}
          sessionExercises={pt.sessionExercises}
          onAddExercise={pt.addExercise}
          onAddCustomExercise={pt.addCustomExercise}
          onAddSet={pt.addSet}
          onDeleteSet={pt.deleteSet}
          onDeleteExercise={pt.deleteSessionExercise}
        />
      ) : (
        <WeeklyVolumeChart volume={pt.weeklyVolume} />
      )}
    </div>
  )
}
