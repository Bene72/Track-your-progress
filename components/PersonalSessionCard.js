'use client'

import { useState, useEffect } from 'react'
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, REST_OPTIONS } from '../lib/constants'

export default function PersonalSessionCard({
  session,
  catalogByMuscle,
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

  const [timeLabel, setTimeLabel] = useState('')
  useEffect(() => {
    setTimeLabel(new Date(session.created_at).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    }))
  }, [session.created_at])

  const handleAddExercise = async () => {
    if (!selectedExerciseId) return
    setError(null)
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

        .empty {
          padding: 22px 12px;
          border: 1px dashed var(--psc-border);
          border-radius: 14px;
          color: var(--psc-muted);
          text-align: center;
          font-size: 12px;
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
        {session.exercises.map(se => (
          <ExerciseBlock
            key={se.id}
            sessionExercise={se}
            onAddSet={(payload) => onAddSet(se.id, payload)}
            onDeleteSet={onDeleteSet}
            onDelete={() => onDeleteExercise(se.id)}
          />
        ))}

        {session.exercises.length === 0 && (
          <div className="empty">
            Aucun exercice dans cette séance pour l’instant.
          </div>
        )}
      </div>
    </div>
  )
}

function ExerciseBlock({ sessionExercise, onAddSet, onDeleteSet, onDelete }) {
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
  }

  return (
    <div className="exercise-block">
      <style jsx>{`
        .exercise-block {
          padding-top: 14px;
          border-top: 1px solid rgba(255,255,255,.075);
        }

        .exercise-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }

        .exercise-name {
          margin: 0 0 3px;
          font-size: 14px;
          font-weight: 850;
        }

        .exercise-muscle {
          margin: 0;
          color: rgba(255,255,255,.45);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .07em;
          text-transform: uppercase;
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
          gap: 5px;
          margin-bottom: 11px;
        }

        .set-row {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border: 1px solid rgba(255,255,255,.055);
          border-radius: 9px;
          background: rgba(255,255,255,.03);
          font-size: 11px;
        }

        .set-main {
          display: flex;
          flex-wrap: wrap;
          gap: 5px 9px;
          color: rgba(255,255,255,.68);
        }

        .set-main strong { color: white; }

        .remove-set {
          border: 0;
          color: rgba(255,255,255,.35);
          background: transparent;
          cursor: pointer;
          font-size: 15px;
        }

        .remove-set:hover { color: #ff8d8d; }

        .input-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .input-grid + .input-grid { margin-top: 8px; }

        .field-label {
          display: block;
          margin-bottom: 5px;
          color: rgba(255,255,255,.45);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .field-input {
          width: 100%;
          box-sizing: border-box;
          min-height: 38px;
          padding: 0 10px;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 9px;
          color: white;
          background: rgba(255,255,255,.035);
          font: inherit;
          font-size: 12px;
          outline: none;
        }

        .field-input:focus {
          border-color: rgba(249,115,22,.65);
          box-shadow: 0 0 0 3px rgba(249,115,22,.09);
        }

        .add-set {
          width: 100%;
          min-height: 40px;
          margin-top: 8px;
          border: 1px solid rgba(249,115,22,.28);
          border-radius: 10px;
          color: #FDBA74;
          background: rgba(249,115,22,.07);
          font: inherit;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          transition: .18s ease;
        }

        .add-set:hover:not(:disabled) {
          background: rgba(249,115,22,.14);
          border-color: rgba(249,115,22,.55);
        }

        .add-set:disabled { opacity: .35; cursor: not-allowed; }

        @media (max-width: 440px) {
          .set-main { gap: 3px 7px; }
        }
      `}</style>

      <div className="exercise-head">
        <div>
          <p className="exercise-name">{sessionExercise.exercise?.name}</p>
          <p className="exercise-muscle">
            {MUSCLE_GROUP_LABELS[sessionExercise.exercise?.muscle_group] || sessionExercise.exercise?.muscle_group}
          </p>
        </div>

        <button type="button" className="delete-btn" onClick={onDelete}>
          Supprimer
        </button>
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
                    {REST_OPTIONS.find(r => Number(r.value) === s.rest_sec)?.label || `${s.rest_sec}s`} repos
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

      <div className="input-grid">
        <div>
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

        <div>
          <label className="field-label">Poids · kg</label>
          <input
            className="field-input"
            type="number"
            min="0"
            step="0.5"
            value={weight}
            onChange={e => setWeight(e.target.value)}
            placeholder="Optionnel"
            inputMode="decimal"
          />
        </div>
      </div>

      <div className="input-grid">
        <div>
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

        <div>
          <label className="field-label">RPE</label>
          <input
            className="field-input"
            type="number"
            min="1"
            max="10"
            step="0.5"
            value={rpe}
            onChange={e => setRpe(e.target.value)}
            placeholder="Optionnel"
            inputMode="decimal"
          />
        </div>
      </div>

      <button
        type="button"
        className="add-set"
        onClick={handleAddSet}
        disabled={!reps}
      >
        ＋ Ajouter la série
      </button>
    </div>
  )
}
