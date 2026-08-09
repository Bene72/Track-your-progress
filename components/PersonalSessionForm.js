'use client'
import { useState } from 'react'
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS } from '../lib/constants'

export default function PersonalSessionForm({
  catalogByMuscle,
  sessionExercises,
  onAddExercise,
  onAddCustomExercise,
  onAddSet,
  onDeleteSet,
  onDeleteExercise,
}) {
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customMuscle, setCustomMuscle] = useState(MUSCLE_GROUPS[0].value)
  const [error, setError] = useState(null)

  const handleAddExercise = async () => {
    if (!selectedExerciseId) return
    try {
      await onAddExercise(selectedExerciseId)
      setSelectedExerciseId('')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleAddCustom = async (e) => {
    e.preventDefault()
    setError(null)
    if (!customName.trim()) return
    try {
      const created = await onAddCustomExercise(customName.trim(), customMuscle)
      setCustomName('')
      setShowCustomForm(false)
      await onAddExercise(created.id)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <label>Exercice</label>
        <select value={selectedExerciseId} onChange={e => setSelectedExerciseId(e.target.value)}>
          <option value="">Choisir un exercice</option>
          {Object.keys(catalogByMuscle).sort().map(muscle => (
            <optgroup key={muscle} label={MUSCLE_GROUP_LABELS[muscle] || muscle}>
              {catalogByMuscle[muscle].map(ex => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <button type="button" className="btn btnGhost" style={{ flex: 1 }} onClick={() => setShowCustomForm(v => !v)}>
            {showCustomForm ? 'Annuler' : '+ Nouvel exercice'}
          </button>
          <button type="button" className="btn btnPrimary" style={{ flex: 1 }} onClick={handleAddExercise} disabled={!selectedExerciseId}>
            Ajouter
          </button>
        </div>

        {showCustomForm && (
          <form onSubmit={handleAddCustom} className="stack" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border, #2A2A2A)' }}>
            <div>
              <label>Nom de l&apos;exercice</label>
              <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Ex: Développé Arnold" maxLength={80} required />
            </div>
            <div>
              <label>Zone travaillée</label>
              <select value={customMuscle} onChange={e => setCustomMuscle(e.target.value)}>
                {MUSCLE_GROUPS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <button type="submit" className="btn btnPrimary btnBlock">Créer et ajouter à la séance</button>
          </form>
        )}
      </div>

      {error && <div className="errorBox">{error}</div>}

      {sessionExercises.map(se => (
        <ExerciseCard
          key={se.id}
          sessionExercise={se}
          onAddSet={(payload) => onAddSet(se.id, payload)}
          onDeleteSet={(setId) => onDeleteSet(se.id, setId)}
          onDelete={() => onDeleteExercise(se.id)}
        />
      ))}

      {sessionExercises.length === 0 && (
        <p className="muted" style={{ fontSize: 13, textAlign: 'center', padding: '1rem 0' }}>
          Aucun exercice pour l&apos;instant.
        </p>
      )}
    </div>
  )
}

function ExerciseCard({ sessionExercise, onAddSet, onDeleteSet, onDelete }) {
  const [reps, setReps] = useState('')
  const [weight, setWeight] = useState('')
  const [rest, setRest] = useState('')
  const [rpe, setRpe] = useState('')

  const handleAddSet = async () => {
    if (!reps) return
    await onAddSet({
      reps: Number(reps),
      weight_kg: weight ? Number(weight) : null,
      rest_sec: rest ? Number(rest) : null,
      rpe: rpe ? Number(rpe) : null,
    })
    setReps(''); setWeight(''); setRest(''); setRpe('')
  }

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 4 }}>
        <div>
          <p style={{ fontWeight: 500 }}>{sessionExercise.exercise?.name}</p>
          <p className="muted" style={{ fontSize: 12 }}>{MUSCLE_GROUP_LABELS[sessionExercise.exercise?.muscle_group] || sessionExercise.exercise?.muscle_group}</p>
        </div>
        <button type="button" className="btn btnGhost btnSm" onClick={onDelete}>Suppr.</button>
      </div>

      {sessionExercise.sets.length > 0 && (
        <div className="stack" style={{ gap: 4, marginBottom: 10 }}>
          {sessionExercise.sets.map((s, i) => (
            <div key={s.id} className="row" style={{ fontSize: 13, padding: '6px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: 6 }}>
              <span>
                Série {i + 1} · {s.reps} reps
                {s.weight_kg ? ` · ${s.weight_kg}kg` : ''}
                {s.rest_sec ? ` · ${s.rest_sec}s repos` : ''}
                {s.rpe ? ` · RPE ${s.rpe}` : ''}
              </span>
              <button type="button" className="btn btnGhost btnSm" onClick={() => onDeleteSet(s.id)}>×</button>
            </div>
          ))}
        </div>
      )}

      <div className="fieldGrid">
        <div><label>Reps</label><input type="number" min="1" value={reps} onChange={e => setReps(e.target.value)} /></div>
        <div><label>Poids (kg)</label><input type="number" min="0" step="0.5" value={weight} onChange={e => setWeight(e.target.value)} placeholder="opt." /></div>
        <div><label>Repos (s)</label><input type="number" min="0" value={rest} onChange={e => setRest(e.target.value)} placeholder="opt." /></div>
        <div><label>RPE</label><input type="number" min="1" max="10" step="0.5" value={rpe} onChange={e => setRpe(e.target.value)} placeholder="opt." /></div>
      </div>
      <button type="button" className="btn btnGhost btnBlock" style={{ marginTop: 8 }} onClick={handleAddSet} disabled={!reps}>
        + Ajouter la série
      </button>
    </div>
  )
}
