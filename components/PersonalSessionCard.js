'use client'

import { useState, useEffect } from 'react'
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, REST_OPTIONS } from '../lib/constants'

export default function PersonalSessionCard({
  session,
  catalogByMuscle,
  onAddExercise,
  onAddExerciseToSuperset,
  onAddCustomExercise,
  onAddSet,
  onDeleteSet,
  onDeleteExercise,
  onMoveExercise,
}) {
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [selectedSupersetPosition, setSelectedSupersetPosition] = useState(null)
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customMuscle, setCustomMuscle] = useState(MUSCLE_GROUPS[0].value)
  const [error, setError] = useState(null)
  const [draggedExercise, setDraggedExercise] = useState(null)

  const [timeLabel, setTimeLabel] = useState('')
  useEffect(() => {
    setTimeLabel(new Date(session.created_at).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    }))
  }, [session.created_at])

  // Grouper les exercices par position (superset)
  const exercisesByPosition = {}
  session.exercises.forEach(se => {
    const pos = se.position ?? 0
    if (!exercisesByPosition[pos]) exercisesByPosition[pos] = []
    exercisesByPosition[pos].push(se)
  })
  const positions = Object.keys(exercisesByPosition).map(Number).sort((a, b) => a - b)

  const handleAddExercise = async () => {
    if (!selectedExerciseId) return
    setError(null)
    try {
      if (selectedSupersetPosition !== null && selectedSupersetPosition !== '') {
        // Ajouter au superset existant
        await onAddExerciseToSuperset(selectedExerciseId, Number(selectedSupersetPosition))
      } else {
        // Ajouter comme nouvel exercice
        await onAddExercise(selectedExerciseId)
      }
      setSelectedExerciseId('')
      setSelectedSupersetPosition(null)
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
      
      if (selectedSupersetPosition !== null && selectedSupersetPosition !== '') {
        await onAddExerciseToSuperset(created.id, Number(selectedSupersetPosition))
      } else {
        await onAddExercise(created.id)
      }
      setSelectedExerciseId('')
      setSelectedSupersetPosition(null)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDragStart = (e, seId) => {
    setDraggedExercise(seId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e, targetPosition) => {
    e.preventDefault()
    if (!draggedExercise) return
    
    try {
      await onMoveExercise(draggedExercise, targetPosition)
    } catch (err) {
      setError(err.message)
    }
    setDraggedExercise(null)
  }

  const getSupersetLabel = (position) => {
    const positionsList = Object.keys(exercisesByPosition)
    const index = positionsList.indexOf(String(position))
    if (index === -1) return ''
    return `Superset ${index + 1}`
  }

  return (
    <div className="psc-card">
      <style jsx>{`
        .psc-card {
          --psc-accent: var(--rx, #F97316);
          --psc-border: rgba(255,255,255,.09);
          --psc-muted: rgba(255,255,255,.52);
          padding: 20px;
          border: 1px solid var(--psc-border);
          border-radius: 22px;
          background:
            linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.025));
          box-shadow: 0 14px 38px rgba(0,0,0,.14);
        }

        .psc-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }

        .psc-title {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .psc-icon {
          display: grid;
          place-items: center;
          width: 38px;
          height: 38px;
          border-radius: 12px;
          color: #FDBA74;
          background: rgba(249,115,22,.13);
          border: 1px solid rgba(249,115,22,.2);
          font-size: 17px;
        }

        .psc-kicker {
          margin: 0 0 2px;
          color: var(--psc-muted);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .1em;
          text-transform: uppercase;
        }

        .psc-name {
          margin: 0;
          font-size: 15px;
          font-weight: 850;
        }

        .psc-time {
          padding: 5px 8px;
          border-radius: 8px;
          color: var(--psc-muted);
          background: rgba(255,255,255,.045);
          font-size: 11px;
        }

        .add-area {
          padding: 14px;
          border: 1px solid var(--psc-border);
          border-radius: 16px;
          background: rgba(0,0,0,.12);
        }

        .label {
          display: block;
          margin-bottom: 7px;
          color: var(--psc-muted);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .exercise-select,
        .custom-input,
        .custom-select {
          width: 100%;
          box-sizing: border-box;
          min-height: 42px;
          padding: 0 12px;
          border: 1px solid var(--psc-border);
          border-radius: 11px;
          color: inherit;
          background: rgba(255,255,255,.045);
          font: inherit;
          font-size: 13px;
          outline: none;
          transition: .18s ease;
        }

        .exercise-select:focus,
        .custom-input:focus,
        .custom-select:focus {
          border-color: rgba(249,115,22,.7);
          box-shadow: 0 0 0 3px rgba(249,115,22,.1);
        }

        .superset-select {
          width: 100%;
          box-sizing: border-box;
          min-height: 42px;
          padding: 0 12px;
          border: 1px solid var(--psc-border);
          border-radius: 11px;
          color: inherit;
          background: rgba(255,255,255,.045);
          font: inherit;
          font-size: 13px;
          outline: none;
          transition: .18s ease;
        }

        .superset-select:focus {
          border-color: rgba(249,115,22,.7);
          box-shadow: 0 0 0 3px rgba(249,115,22,.1);
        }

        .action-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 9px;
        }

        .action {
          min-height: 40px;
          border: 1px solid var(--psc-border);
          border-radius: 10px;
          color: rgba(255,255,255,.75);
          background: rgba(255,255,255,.035);
          font: inherit;
          font-size: 12px;
          font-weight: 750;
          cursor: pointer;
          transition: .18s ease;
        }

        .action:hover:not(:disabled) {
          background: rgba(255,255,255,.07);
          border-color: rgba(255,255,255,.16);
        }

        .action.primary {
          border-color: transparent;
          color: white;
          background: linear-gradient(135deg, #F97316, #C2410C);
          box-shadow: 0 7px 18px rgba(249,115,22,.18);
        }

        .action.primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 10px 22px rgba(249,115,22,.27);
        }

        .action:disabled { opacity: .4; cursor: not-allowed; }

        .custom-form {
          display: grid;
          gap: 10px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--psc-border);
        }

        .error {
          margin-top: 10px;
          padding: 10px 12px;
          border: 1px solid rgba(255,92,92,.2);
          border-radius: 10px;
          color: #ffb1b1;
          background: rgba(255,92,92,.08);
          font-size: 12px;
        }

        .exercise-list {
          display: grid;
          gap: 12px;
          margin-top: 16px;
        }

        .superset-group {
          border: 1px solid rgba(249,115,22,.15);
          border-radius: 12px;
          padding: 8px;
          background: rgba(249,115,22,.04);
        }

        .superset-header {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          color: #FDBA74;
          padding: 4px 8px;
          margin-bottom: 6px;
          letter-spacing: .08em;
        }

        .exercise-item {
          padding: 8px 10px;
          margin-bottom: 4px;
          border-radius: 8px;
          background: rgba(255,255,255,.03);
          cursor: grab;
          transition: .18s ease;
        }

        .exercise-item:last-child { margin-bottom: 0; }

        .exercise-item.dragging {
          opacity: .4;
          border: 1px dashed rgba(249,115,22,.4);
        }

        .exercise-item.drag-over {
          border-color: rgba(249,115,22,.6);
          background: rgba(249,115,22,.08);
        }

        .empty {
          padding: 22px 12px;
          border: 1px dashed var(--psc-border);
          border-radius: 14px;
          color: var(--psc-muted);
          text-align: center;
          font-size: 12px;
        }

        .drop-zone {
          border: 1px dashed rgba(249,115,22,.2);
          border-radius: 8px;
          padding: 12px;
          text-align: center;
          color: rgba(255,255,255,.3);
          font-size: 11px;
          transition: .18s ease;
          margin-top: 4px;
        }

        .drop-zone.drag-over {
          border-color: rgba(249,115,22,.6);
          background: rgba(249,115,22,.06);
          color: rgba(255,255,255,.6);
        }

        @media (max-width: 520px) {
          .psc-card { padding: 15px; border-radius: 18px; }
          .action-row { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="psc-head">
        <div className="psc-title">
          <div className="psc-icon">▦</div>
          <div>
            <p className="psc-kicker">Session</p>
            <p className="psc-name">Entraînement personnel</p>
          </div>
        </div>
        {timeLabel && <span className="psc-time">{timeLabel}</span>}
      </div>

      <div className="add-area">
        <label className="label">Ajouter un exercice</label>

        <select
          className="exercise-select"
          value={selectedExerciseId}
          onChange={e => setSelectedExerciseId(e.target.value)}
        >
          <option value="">Choisir un exercice…</option>
          {Object.keys(catalogByMuscle).sort().map(muscle => (
            <optgroup key={muscle} label={MUSCLE_GROUP_LABELS[muscle] || muscle}>
              {catalogByMuscle[muscle].map(ex => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </optgroup>
          ))}
        </select>

        {positions.length > 0 && (
          <>
            <label className="label" style={{ marginTop: 10 }}>Ajouter à un superset (optionnel)</label>
            <select
              className="superset-select"
              value={selectedSupersetPosition ?? ''}
              onChange={e => setSelectedSupersetPosition(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Nouvel exercice seul</option>
              {positions.map(pos => (
                <option key={pos} value={pos}>
                  {getSupersetLabel(pos)} ({exercisesByPosition[pos].map(e => e.exercise?.name).join(' + ')})
                </option>
              ))}
            </select>
          </>
        )}

        <div className="action-row">
          <button
            type="button"
            className="action"
            onClick={() => setShowCustomForm(v => !v)}
          >
            {showCustomForm ? 'Annuler' : '＋ Exercice perso'}
          </button>
          <button
            type="button"
            className="action primary"
            onClick={handleAddExercise}
            disabled={!selectedExerciseId}
          >
            Ajouter l’exercice
          </button>
        </div>

        {showCustomForm && (
          <form onSubmit={handleAddCustom} className="custom-form">
            <div>
              <label className="label">Nom de l’exercice</label>
              <input
                className="custom-input"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                placeholder="Ex. Développé Arnold"
                maxLength={80}
                required
              />
            </div>

            <div>
              <label className="label">Zone travaillée</label>
              <select
                className="custom-select"
                value={customMuscle}
                onChange={e => setCustomMuscle(e.target.value)}
              >
                {MUSCLE_GROUPS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <button type="submit" className="action primary">
              Créer et ajouter à la séance
            </button>
          </form>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="exercise-list">
        {positions.map(pos => {
          const exercises = exercisesByPosition[pos]
          const isSuperset = exercises.length > 1
          
          return (
            <div 
              key={pos} 
              className={isSuperset ? 'superset-group' : ''}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, pos)}
            >
              {isSuperset && (
                <div className="superset-header">
                  🔄 {getSupersetLabel(pos)} — {exercises.map(e => e.exercise?.name).join(' + ')}
                  <span style={{ fontSize: 9, fontWeight: 400, color: 'rgba(255,255,255,.4)', marginLeft: 8 }}>
                    (glisse un exercice pour changer de groupe)
                  </span>
                </div>
              )}
              
              {exercises.map(se => (
                <div
                  key={se.id}
                  className={`exercise-item ${draggedExercise === se.id ? 'dragging' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, se.id)}
                  onDragEnd={() => setDraggedExercise(null)}
                >
                  <ExerciseBlock
                    sessionExercise={se}
                    onAddSet={(payload) => onAddSet(se.id, payload)}
                    onDeleteSet={onDeleteSet}
                    onDelete={() => onDeleteExercise(se.id)}
                    isSuperset={isSuperset}
                  />
                </div>
              ))}

              {!isSuperset && positions.length > 1 && (
                <div 
                  className={`drop-zone ${draggedExercise ? 'drag-over' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over') }}
                  onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
                  onDrop={(e) => {
                    e.currentTarget.classList.remove('drag-over')
                    handleDrop(e, pos)
                  }}
                >
                  Déposer ici pour ajouter à ce superset
                </div>
              )}
            </div>
          )
        })}

        {session.exercises.length === 0 && (
          <div className="empty">
            Aucun exercice dans cette séance pour l’instant.
          </div>
        )}
      </div>
    </div>
  )
}

function ExerciseBlock({ sessionExercise, onAddSet, onDeleteSet, onDelete, isSuperset }) {
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
    setReps('')
    setWeight('')
    setRpe('')
  }

  return (
    <div className="exercise-block">
      <style jsx>{`
        .exercise-block {
          position: relative;
        }

        .exercise-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 8px;
        }

        .exercise-name {
          margin: 0 0 2px;
          font-size: 13px;
          font-weight: 850;
        }

        .exercise-muscle {
          margin: 0;
          color: rgba(255,255,255,.45);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: .07em;
          text-transform: uppercase;
        }

        .exercise-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .drag-handle {
          color: rgba(255,255,255,.2);
          font-size: 14px;
          cursor: grab;
        }

        .delete-btn {
          border: 0;
          color: rgba(255,255,255,.38);
          background: transparent;
          font: inherit;
          font-size: 11px;
          cursor: pointer;
        }

        .delete-btn:hover { color: #ff8d8d; }

        .sets {
          display: grid;
          gap: 4px;
          margin-bottom: 8px;
        }

        .set-row {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 8px;
          padding: 5px 8px;
          border: 1px solid rgba(255,255,255,.055);
          border-radius: 7px;
          background: rgba(255,255,255,.03);
          font-size: 10px;
        }

        .set-main {
          display: flex;
          flex-wrap: wrap;
          gap: 4px 8px;
          color: rgba(255,255,255,.68);
        }

        .set-main strong { color: white; }

        .remove-set {
          border: 0;
          color: rgba(255,255,255,.35);
          background: transparent;
          cursor: pointer;
          font-size: 14px;
        }

        .remove-set:hover { color: #ff8d8d; }

        .input-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .input-group {
          flex: 1;
          min-width: 50px;
        }

        .field-label {
          display: block;
          margin-bottom: 3px;
          color: rgba(255,255,255,.45);
          font-size: 8px;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .field-input {
          width: 100%;
          box-sizing: border-box;
          min-height: 32px;
          padding: 0 8px;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 7px;
          color: white;
          background: rgba(255,255,255,.035);
          font: inherit;
          font-size: 11px;
          outline: none;
        }

        .field-input:focus {
          border-color: rgba(249,115,22,.65);
          box-shadow: 0 0 0 3px rgba(249,115,22,.09);
        }

        .add-set {
          width: 100%;
          min-height: 32px;
          margin-top: 6px;
          border: 1px solid rgba(249,115,22,.28);
          border-radius: 8px;
          color: #FDBA74;
          background: rgba(249,115,22,.07);
          font: inherit;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
          transition: .18s ease;
        }

        .add-set:hover:not(:disabled) {
          background: rgba(249,115,22,.14);
          border-color: rgba(249,115,22,.55);
        }

        .add-set:disabled { opacity: .35; cursor: not-allowed; }

        .superset-badge {
          display: inline-block;
          padding: 1px 8px;
          margin-left: 8px;
          border-radius: 4px;
          background: rgba(249,115,22,.15);
          color: #FDBA74;
          font-size: 8px;
          font-weight: 700;
          text-transform: uppercase;
        }
      `}</style>

      <div className="exercise-head">
        <div>
          <p className="exercise-name">
            {sessionExercise.exercise?.name}
            {isSuperset && <span className="superset-badge">Superset</span>}
          </p>
          <p className="exercise-muscle">
            {MUSCLE_GROUP_LABELS[sessionExercise.exercise?.muscle_group] || sessionExercise.exercise?.muscle_group}
          </p>
        </div>

        <div className="exercise-actions">
          <span className="drag-handle">⠿</span>
          <button type="button" className="delete-btn" onClick={onDelete}>
            Supprimer
          </button>
        </div>
      </div>

      {sessionExercise.sets.length > 0 && (
        <div className="sets">
          {sessionExercise.sets.map((s, i) => (
            <div key={s.id} className="set-row">
              <div className="set-main">
                <span><strong>S{i + 1}</strong></span>
                <span>{s.reps} reps</span>
                {s.weight_kg ? <span>{s.weight_kg} kg</span> : null}
                {s.rest_sec ? (
                  <span>
                    {REST_OPTIONS.find(r => Number(r.value) === s.rest_sec)?.label || `${s.rest_sec}s`}
                  </span>
                ) : null}
                {s.rpe ? <span>RPE {s.rpe}</span> : null}
              </div>

              <button
                type="button"
                className="remove-set"
                onClick={() => onDeleteSet(s.id)}
                aria-label={`Supprimer la série ${i + 1}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="input-row">
        <div className="input-group" style={{ flex: 1 }}>
          <label className="field-label">Reps</label>
          <input
            className="field-input"
            type="number"
            min="1"
            value={reps}
            onChange={e => setReps(e.target.value)}
            inputMode="numeric"
          />
        </div>

        <div className="input-group" style={{ flex: 1 }}>
          <label className="field-label">Poids</label>
          <input
            className="field-input"
            type="number"
            min="0"
            step="0.5"
            value={weight}
            onChange={e => setWeight(e.target.value)}
            placeholder="kg"
            inputMode="decimal"
          />
        </div>

        <div className="input-group" style={{ flex: 0.8 }}>
          <label className="field-label">Repos</label>
          <select
            className="field-input"
            value={rest}
            onChange={e => setRest(e.target.value)}
          >
            {REST_OPTIONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <div className="input-group" style={{ flex: 0.6 }}>
          <label className="field-label">RPE</label>
          <input
            className="field-input"
            type="number"
            min="1"
            max="10"
            step="0.5"
            value={rpe}
            onChange={e => setRpe(e.target.value)}
            placeholder="RPE"
            inputMode="decimal"
          />
        </div>

        <button
          type="button"
          className="add-set"
          onClick={handleAddSet}
          disabled={!reps}
        >
          ＋ Série
        </button>
      </div>
    </div>
  )
}