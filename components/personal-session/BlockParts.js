'use client'
import { useState } from 'react'
import { MUSCLE_GROUP_LABELS, REST_OPTIONS } from '../../lib/constants'
import { ROUNDS_TYPES, defaultMuscleGroup } from './helpers'
import ExerciseAutocomplete from './ExerciseAutocomplete'

// Commentaire libre par bloc : consignes d'exécution, pace visé, tempo,
// ressenti, douleur, sommeil... Le champ `notes` existe déjà en base sur
// personal_blocks ; onSave passe par onUpdateBlock qui patch la colonne.
export function BlockComment({ block, onSave }) {
  const [value, setValue] = useState(block.notes || '')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)

  const dirty = value !== (block.notes || '')

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(value)
      setSavedAt(Date.now())
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="block-notes">
      <style jsx>{`
        .block-notes { margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,.06); }
        .block-notes-label { display: block; margin-bottom: 6px; color: rgba(255,255,255,.4); font-size: 9px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
        .block-notes-input { width: 100%; box-sizing: border-box; min-height: 54px; padding: 8px 10px; border: 1px solid var(--psc-border); border-radius: 9px; color: white; background: rgba(255,255,255,.03); font: inherit; font-size: 11.5px; line-height: 1.5; resize: vertical; outline: none; }
        .block-notes-input:focus { border-color: rgba(249,115,22,.65); box-shadow: 0 0 0 3px rgba(249,115,22,.09); }
        .block-notes-input::placeholder { color: rgba(255,255,255,.28); }
        .block-notes-save { margin-top: 6px; min-height: 28px; padding: 0 10px; border-radius: 7px; border: 1px solid rgba(249,115,22,.28); color: #FDBA74; background: rgba(249,115,22,.08); font: inherit; font-size: 10px; font-weight: 800; cursor: pointer; }
        .block-notes-save:hover:not(:disabled) { background: rgba(249,115,22,.16); }
        .block-notes-save:disabled { opacity: .45; cursor: default; }
        .block-notes-saved { margin-top: 6px; color: rgba(255,255,255,.35); font-size: 10px; }
      `}</style>
      <label className="block-notes-label">Commentaire</label>
      <textarea
        className="block-notes-input"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Consignes d'exécution, pace visé, tempo, ressenti, douleur…"
        maxLength={2000}
      />
      {dirty ? (
        <button type="button" className="block-notes-save" onClick={handleSave} disabled={saving}>
          {saving ? '...' : 'Enregistrer le commentaire'}
        </button>
      ) : savedAt ? (
        <p className="block-notes-saved">Enregistré</p>
      ) : null}
    </div>
  )
}

// Notes libres pour l'ensemble de la séance (ressenti général, contexte du
// jour, sommeil, motivation...) — distinct du Commentaire par bloc, qui porte
// sur l'exécution d'un bloc précis (consignes, pace...). Nécessite une
// colonne `notes` (text, nullable) sur la table `personal_sessions`.
export function SessionNotes({ session, onSave }) {
  const [value, setValue] = useState(session.notes || '')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)

  const dirty = value !== (session.notes || '')

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(value)
      setSavedAt(Date.now())
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="session-notes">
      <style jsx>{`
        .session-notes { padding: 14px; margin-bottom: 14px; border: 1px solid var(--psc-border); border-radius: 16px; background: rgba(255,255,255,.03); }
        .session-notes-head { display: flex; align-items: center; gap: 8px; margin-bottom: 9px; }
        .session-notes-icon { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; color: #FDBA74; background: rgba(249,115,22,.13); font-size: 13px; flex: 0 0 auto; }
        .session-notes-label { margin: 0; color: rgba(255,255,255,.8); font-size: 12px; font-weight: 800; }
        .session-notes-input { width: 100%; box-sizing: border-box; min-height: 70px; padding: 10px 12px; border: 1px solid var(--psc-border); border-radius: 11px; color: white; background: rgba(255,255,255,.04); font: inherit; font-size: 13px; line-height: 1.55; resize: vertical; outline: none; transition: .18s ease; }
        .session-notes-input:focus { border-color: rgba(249,115,22,.65); box-shadow: 0 0 0 3px rgba(249,115,22,.09); }
        .session-notes-input::placeholder { color: rgba(255,255,255,.28); }
        .session-notes-footer { display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-top: 8px; }
        .session-notes-status { color: rgba(255,255,255,.35); font-size: 11px; }
        .session-notes-save { min-height: 34px; padding: 0 14px; border: 0; border-radius: 9px; color: white; background: linear-gradient(135deg, #F97316, #C2410C); font: inherit; font-size: 12px; font-weight: 750; cursor: pointer; box-shadow: 0 7px 18px rgba(249,115,22,.18); transition: .18s ease; }
        .session-notes-save:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 22px rgba(249,115,22,.27); }
        .session-notes-save:disabled { opacity: .4; cursor: not-allowed; box-shadow: none; transform: none; }
      `}</style>
      <div className="session-notes-head">
        <span className="session-notes-icon">🗒</span>
        <p className="session-notes-label">Notes de la séance</p>
      </div>
      <textarea
        className="session-notes-input"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Ressenti général, contexte du jour, sommeil, motivation…"
        maxLength={4000}
      />
      <div className="session-notes-footer">
        {!dirty && savedAt && <span className="session-notes-status">Enregistré</span>}
        <button type="button" className="session-notes-save" onClick={handleSave} disabled={!dirty || saving}>
          {saving ? '...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}

export function AddToBlockInline({ blockId, catalog, onAddExerciseToBlock, onAddCustomExercise }) {
  const [open, setOpen] = useState(false)
  const [exerciseId, setExerciseId] = useState('')
  const [exerciseQuery, setExerciseQuery] = useState('')
  const [reps, setReps] = useState('')
  const [weight, setWeight] = useState('')
  const [distance, setDistance] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleCreateExercise = async (name) => {
    setError(null)
    try {
      return await onAddCustomExercise(name, defaultMuscleGroup())
    } catch (err) {
      setError(err.message)
      return null
    }
  }

  const handleAdd = async () => {
    setSaving(true)
    setError(null)
    try {
      let id = exerciseId
      if (!id) {
        const name = exerciseQuery.trim()
        if (!name) return
        const created = await handleCreateExercise(name)
        if (!created) return
        id = created.id
      }
      await onAddExerciseToBlock(blockId, id, {
        targetReps: reps ? Number(reps) : null,
        targetWeightKg: weight ? Number(weight) : null,
        targetDistanceM: distance ? Number(distance) : null,
      })
      setExerciseId('')
      setExerciseQuery('')
      setReps('')
      setWeight('')
      setDistance('')
      setOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="add-to-block">
      <style jsx>{`
        .add-to-block { margin-top: 10px; }
        .add-to-block-toggle { width: 100%; min-height: 34px; border: 1px dashed rgba(255,255,255,.16); border-radius: 9px; color: rgba(255,255,255,.55); background: transparent; font: inherit; font-size: 10px; font-weight: 800; cursor: pointer; transition: .18s ease; }
        .add-to-block-toggle:hover { border-color: rgba(249,115,22,.5); color: #FDBA74; background: rgba(249,115,22,.06); }
        .add-to-block-form { padding: 10px; border: 1px solid rgba(255,255,255,.08); border-radius: 10px; background: rgba(255,255,255,.025); display: grid; gap: 8px; }
        .field-input { width: 100%; box-sizing: border-box; min-height: 32px; padding: 0 8px; border: 1px solid rgba(255,255,255,.08); border-radius: 7px; color: white; background: rgba(255,255,255,.035); font: inherit; font-size: 11px; outline: none; }
        .field-input:focus { border-color: rgba(249,115,22,.65); box-shadow: 0 0 0 3px rgba(249,115,22,.09); }
        .add-to-block-targets { display: flex; gap: 6px; }
        .add-to-block-actions { display: flex; gap: 8px; }
        .add-to-block-actions button { flex: 1; min-height: 32px; border-radius: 8px; font: inherit; font-size: 10px; font-weight: 800; cursor: pointer; border: 1px solid transparent; }
        .btn-cancel { color: rgba(255,255,255,.5); background: transparent; border-color: rgba(255,255,255,.12) !important; }
        .btn-cancel:hover { color: white; }
        .btn-primary { color: #FDBA74; background: rgba(249,115,22,.1); border-color: rgba(249,115,22,.3) !important; }
        .btn-primary:hover:not(:disabled) { background: rgba(249,115,22,.18); }
        .btn-primary:disabled { opacity: .4; cursor: not-allowed; }
        .add-to-block-error { color: #ff8d8d; font-size: 10px; }
      `}</style>

      {!open ? (
        <button type="button" className="add-to-block-toggle" onClick={() => setOpen(true)}>
          ＋ Ajouter un mouvement à ce bloc
        </button>
      ) : (
        <div className="add-to-block-form">
          <ExerciseAutocomplete
            catalog={catalog}
            value={exerciseId}
            onChange={setExerciseId}
            onCreateNew={handleCreateExercise}
            onQueryChange={setExerciseQuery}
          />
          <div className="add-to-block-targets">
            <input className="field-input" type="number" placeholder="Reps" value={reps}
              onChange={e => setReps(e.target.value)} inputMode="numeric" />
            <input className="field-input" type="number" placeholder="kg" value={weight}
              onChange={e => setWeight(e.target.value)} inputMode="decimal" step="0.5" />
            <input className="field-input" type="number" placeholder="m" value={distance}
              onChange={e => setDistance(e.target.value)} inputMode="numeric" />
          </div>
          {error && <div className="add-to-block-error">{error}</div>}
          <div className="add-to-block-actions">
            <button type="button" className="btn-cancel" onClick={() => setOpen(false)}>Annuler</button>
            <button type="button" className="btn-primary" onClick={handleAdd} disabled={(!exerciseId && !exerciseQuery.trim()) || saving}>
              {saving ? '...' : (!exerciseId && exerciseQuery.trim() ? 'Créer et ajouter' : 'Ajouter')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function BlockSettingsForm({ block, onSave, onCancel }) {
  const [rounds, setRounds] = useState(block.rounds ?? '')
  const [interval, setIntervalSec] = useState(block.interval_sec ?? '')
  const [timeCap, setTimeCap] = useState(block.time_cap_sec ?? '')
  const [saving, setSaving] = useState(false)

  const showRounds = ROUNDS_TYPES.has(block.block_type)
  const showInterval = block.block_type === 'emom'
  const showTimeCap = block.block_type === 'amrap' || block.block_type === 'for_time'

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({
        rounds: showRounds ? (rounds ? Number(rounds) : null) : undefined,
        intervalSec: showInterval ? (interval ? Number(interval) : null) : undefined,
        timeCapSec: showTimeCap ? (timeCap ? Number(timeCap) : null) : undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="block-settings">
      <style jsx>{`
        .block-settings { padding: 10px; margin-bottom: 10px; border: 1px solid rgba(249,115,22,.28); border-radius: 10px; background: rgba(249,115,22,.045); }
        .block-settings-fields { display: flex; gap: 8px; flex-wrap: wrap; }
        .input-group { flex: 1; min-width: 90px; }
        .field-label { display: block; margin-bottom: 3px; color: rgba(255,255,255,.45); font-size: 8px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
        .field-input { width: 100%; box-sizing: border-box; min-height: 32px; padding: 0 8px; border: 1px solid rgba(255,255,255,.08); border-radius: 7px; color: white; background: rgba(255,255,255,.035); font: inherit; font-size: 11px; outline: none; }
        .field-input:focus { border-color: rgba(249,115,22,.65); box-shadow: 0 0 0 3px rgba(249,115,22,.09); }
        .block-settings-actions { display: flex; gap: 8px; margin-top: 8px; }
        .block-settings-actions button { flex: 1; min-height: 32px; border-radius: 8px; font: inherit; font-size: 10px; font-weight: 800; cursor: pointer; border: 1px solid transparent; }
        .cancel-settings { color: rgba(255,255,255,.5); background: transparent; border-color: rgba(255,255,255,.12) !important; }
        .save-settings { color: #FDBA74; background: rgba(249,115,22,.12); border-color: rgba(249,115,22,.32) !important; }
        .save-settings:hover:not(:disabled) { background: rgba(249,115,22,.2); }
        .save-settings:disabled { opacity: .5; cursor: not-allowed; }
      `}</style>
      <div className="block-settings-fields">
        {showRounds && (
          <div className="input-group">
            <label className="field-label">{block.block_type === 'emom' ? 'Durée (min)' : 'Rounds'}</label>
            <input className="field-input" type="number" min="1" value={rounds} onChange={e => setRounds(e.target.value)} />
          </div>
        )}
        {showInterval && (
          <div className="input-group">
            <label className="field-label">Intervalle (sec)</label>
            <input className="field-input" type="number" min="1" value={interval} onChange={e => setIntervalSec(e.target.value)} />
          </div>
        )}
        {showTimeCap && (
          <div className="input-group">
            <label className="field-label">Time cap (sec)</label>
            <input className="field-input" type="number" min="1" value={timeCap} onChange={e => setTimeCap(e.target.value)} />
          </div>
        )}
      </div>
      <div className="block-settings-actions">
        <button type="button" className="cancel-settings" onClick={onCancel}>Annuler</button>
        <button type="button" className="save-settings" onClick={handleSave} disabled={saving}>
          {saving ? '...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}

export function ResultForm({ block, onSubmit }) {
  const [timeSec, setTimeSec] = useState(block.result_time_sec ?? '')
  const [rounds, setRounds] = useState(block.result_rounds ?? '')
  const [reps, setReps] = useState(block.result_reps ?? '')

  const handleSave = async () => {
    await onSubmit({
      result_time_sec: timeSec ? Number(timeSec) : null,
      result_rounds: rounds ? Number(rounds) : null,
      result_reps: reps ? Number(reps) : null,
    })
  }

  return (
    <div className="result-row">
      {block.block_type === 'for_time' ? (
        <input className="mini-input" type="number" placeholder="Temps (sec)" value={timeSec}
          onChange={e => setTimeSec(e.target.value)} style={{ maxWidth: 130 }} />
      ) : (
        <>
          <input className="mini-input" type="number" placeholder="Rounds complets" value={rounds}
            onChange={e => setRounds(e.target.value)} style={{ maxWidth: 130 }} />
          <input className="mini-input" type="number" placeholder="Reps en +" value={reps}
            onChange={e => setReps(e.target.value)} style={{ maxWidth: 110 }} />
        </>
      )}
      <button type="button" className="action primary" style={{ minHeight: 38, padding: '0 14px' }} onClick={handleSave}>
        Enregistrer le résultat
      </button>
    </div>
  )
}

export function EditableSetRow({ log, onUpsertSetLog }) {
  const [editing, setEditing] = useState(false)
  const [reps, setReps] = useState(log.reps ?? '')
  const [weight, setWeight] = useState(log.weight_kg ?? '')
  const [distance, setDistance] = useState(log.distance_m ?? '')
  const [rest, setRest] = useState(log.rest_sec ?? '')
  const [rpe, setRpe] = useState(log.rpe ?? '')

  const handleSave = async () => {
    await onUpsertSetLog(log.round_number, {
      reps: reps ? Number(reps) : null,
      weight_kg: weight ? Number(weight) : null,
      distance_m: distance ? Number(distance) : null,
      rest_sec: rest ? Number(rest) : null,
      rpe: rpe ? Number(rpe) : null,
    })
    setEditing(false)
  }

  return (
    <div className="editable-set-row">
      <style jsx>{`
        .set-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 5px 8px; border: 1px solid rgba(255,255,255,.055); border-radius: 7px; background: rgba(255,255,255,.03); font-size: 10px; }
        .set-main { display: flex; flex-wrap: wrap; gap: 4px 8px; color: rgba(255,255,255,.68); }
        .set-main strong { color: white; }
        .edit-set-btn { flex: 0 0 auto; border: 0; color: rgba(255,255,255,.38); background: transparent; font: inherit; font-size: 10px; font-weight: 700; cursor: pointer; }
        .edit-set-btn:hover { color: #FDBA74; }
        .set-row-edit { padding: 8px; border: 1px solid rgba(249,115,22,.28); border-radius: 8px; background: rgba(249,115,22,.045); }
        .input-row { display: flex; gap: 6px; flex-wrap: wrap; }
        .input-group { flex: 1; min-width: 50px; }
        .field-label { display: block; margin-bottom: 3px; color: rgba(255,255,255,.45); font-size: 8px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
        .field-input { width: 100%; box-sizing: border-box; min-height: 32px; padding: 0 8px; border: 1px solid rgba(255,255,255,.08); border-radius: 7px; color: white; background: rgba(255,255,255,.035); font: inherit; font-size: 11px; outline: none; }
        .field-input:focus { border-color: rgba(249,115,22,.65); box-shadow: 0 0 0 3px rgba(249,115,22,.09); }
        .set-row-edit-actions { display: flex; gap: 8px; margin-top: 6px; }
        .set-row-edit-actions button { flex: 1; min-height: 30px; border-radius: 7px; font: inherit; font-size: 10px; font-weight: 800; cursor: pointer; border: 1px solid transparent; }
        .cancel-edit { color: rgba(255,255,255,.5); background: transparent; border-color: rgba(255,255,255,.12) !important; }
        .save-edit { color: #FDBA74; background: rgba(249,115,22,.12); border-color: rgba(249,115,22,.32) !important; }
        .save-edit:hover { background: rgba(249,115,22,.2); }
      `}</style>

      {!editing ? (
        <div className="set-row">
          <div className="set-main">
            <span><strong>R{log.round_number}</strong></span>
            {log.reps != null && <span>{log.reps} reps</span>}
            {log.weight_kg ? <span>{log.weight_kg} kg</span> : null}
            {log.distance_m ? <span>{log.distance_m} m</span> : null}
            {log.rest_sec ? <span>{REST_OPTIONS.find(r => Number(r.value) === log.rest_sec)?.label || `${log.rest_sec}s`}</span> : null}
            {log.rpe ? <span>RPE {log.rpe}</span> : null}
          </div>
          <button type="button" className="edit-set-btn" onClick={() => setEditing(true)}>Modifier</button>
        </div>
      ) : (
        <div className="set-row-edit">
          <div className="input-row">
            <div className="input-group">
              <label className="field-label">Reps</label>
              <input className="field-input" type="number" min="0" value={reps} onChange={e => setReps(e.target.value)} inputMode="numeric" />
            </div>
            <div className="input-group">
              <label className="field-label">Poids</label>
              <input className="field-input" type="number" min="0" step="0.5" value={weight} onChange={e => setWeight(e.target.value)} placeholder="kg" inputMode="decimal" />
            </div>
            <div className="input-group" style={{ flex: 0.8 }}>
              <label className="field-label">Distance</label>
              <input className="field-input" type="number" min="0" value={distance} onChange={e => setDistance(e.target.value)} placeholder="m" inputMode="numeric" />
            </div>
            <div className="input-group" style={{ flex: 0.8 }}>
              <label className="field-label">Repos</label>
              <select className="field-input" value={rest} onChange={e => setRest(e.target.value)}>
                {REST_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="input-group" style={{ flex: 0.6 }}>
              <label className="field-label">RPE</label>
              <input className="field-input" type="number" min="1" max="10" step="0.5" value={rpe} onChange={e => setRpe(e.target.value)} placeholder="RPE" inputMode="decimal" />
            </div>
          </div>
          <div className="set-row-edit-actions">
            <button type="button" className="cancel-edit" onClick={() => setEditing(false)}>Annuler</button>
            <button type="button" className="save-edit" onClick={handleSave}>Enregistrer</button>
          </div>
        </div>
      )}
    </div>
  )
}

export function MovementBlock({ blockExercise, blockType, onUpsertSetLog, onRemove }) {
  const [reps, setReps] = useState(blockExercise.target_reps ?? '')
  const [weight, setWeight] = useState(blockExercise.target_weight_kg ?? '')
  const [distance, setDistance] = useState(blockExercise.target_distance_m ?? '')
  const [rest, setRest] = useState('')
  const [rpe, setRpe] = useState('')

  const nextRound = (blockExercise.logs?.length || 0) + 1

  const handleAddRound = async () => {
    if (!reps && !distance) return
    await onUpsertSetLog(nextRound, {
      reps: reps ? Number(reps) : null,
      weight_kg: weight ? Number(weight) : null,
      distance_m: distance ? Number(distance) : null,
      rest_sec: rest ? Number(rest) : null,
      rpe: rpe ? Number(rpe) : null,
    })
  }

  return (
    <div className="exercise-block">
      <style jsx>{`
        .exercise-block { position: relative; }
        .exercise-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
        .exercise-name { margin: 0 0 2px; font-size: 13px; font-weight: 850; }
        .exercise-muscle { margin: 0; color: rgba(255,255,255,.45); font-size: 9px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; }
        .exercise-actions { display: flex; align-items: center; gap: 8px; }
        .drag-handle { color: rgba(255,255,255,.2); font-size: 14px; cursor: grab; }
        .delete-btn { border: 0; color: rgba(255,255,255,.38); background: transparent; font: inherit; font-size: 11px; cursor: pointer; }
        .delete-btn:hover { color: #ff8d8d; }
        .sets { display: grid; gap: 4px; margin-bottom: 8px; }
        .input-row { display: flex; gap: 6px; flex-wrap: wrap; }
        .input-group { flex: 1; min-width: 50px; }
        .field-label { display: block; margin-bottom: 3px; color: rgba(255,255,255,.45); font-size: 8px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
        .field-input { width: 100%; box-sizing: border-box; min-height: 32px; padding: 0 8px; border: 1px solid rgba(255,255,255,.08); border-radius: 7px; color: white; background: rgba(255,255,255,.035); font: inherit; font-size: 11px; outline: none; }
        .field-input:focus { border-color: rgba(249,115,22,.65); box-shadow: 0 0 0 3px rgba(249,115,22,.09); }
        .add-set { width: 100%; min-height: 32px; margin-top: 6px; border: 1px solid rgba(249,115,22,.28); border-radius: 8px; color: #FDBA74; background: rgba(249,115,22,.07); font: inherit; font-size: 10px; font-weight: 800; cursor: pointer; transition: .18s ease; }
        .add-set:hover:not(:disabled) { background: rgba(249,115,22,.14); border-color: rgba(249,115,22,.55); }
        .add-set:disabled { opacity: .35; cursor: not-allowed; }
      `}</style>

      <div className="exercise-head">
        <div>
          <p className="exercise-name">{blockExercise.exercise?.name}</p>
          <p className="exercise-muscle">
            {MUSCLE_GROUP_LABELS[blockExercise.exercise?.muscle_group] || blockExercise.exercise?.muscle_group}
          </p>
        </div>
        <div className="exercise-actions">
          <span className="drag-handle">⠿</span>
          <button type="button" className="delete-btn" onClick={onRemove}>Retirer</button>
        </div>
      </div>

      {blockExercise.logs?.length > 0 && (
        <div className="sets">
          {blockExercise.logs.map(l => (
            <EditableSetRow key={l.id} log={l} onUpsertSetLog={onUpsertSetLog} />
          ))}
        </div>
      )}

      {blockType !== 'amrap' && (
        <div className="input-row">
          <div className="input-group">
            <label className="field-label">Reps</label>
            <input className="field-input" type="number" min="0" value={reps}
              onChange={e => setReps(e.target.value)} inputMode="numeric" />
          </div>
          <div className="input-group">
            <label className="field-label">Poids</label>
            <input className="field-input" type="number" min="0" step="0.5" value={weight}
              onChange={e => setWeight(e.target.value)} placeholder="kg" inputMode="decimal" />
          </div>
          <div className="input-group" style={{ flex: 0.8 }}>
            <label className="field-label">Distance</label>
            <input className="field-input" type="number" min="0" value={distance}
              onChange={e => setDistance(e.target.value)} placeholder="m" inputMode="numeric" />
          </div>
          <div className="input-group" style={{ flex: 0.8 }}>
            <label className="field-label">Repos</label>
            <select className="field-input" value={rest} onChange={e => setRest(e.target.value)}>
              {REST_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="input-group" style={{ flex: 0.6 }}>
            <label className="field-label">RPE</label>
            <input className="field-input" type="number" min="1" max="10" step="0.5" value={rpe}
              onChange={e => setRpe(e.target.value)} placeholder="RPE" inputMode="decimal" />
          </div>
          <button type="button" className="add-set" onClick={handleAddRound} disabled={!reps && !distance}>
            ＋ Round {nextRound}
          </button>
        </div>
      )}
    </div>
  )
}

// Affiche un superset (2+ mouvements) sur des lignes combinées : chaque round
// montre les deux exercices côte à côte ("10 reps + 10 reps"), et un seul
// bouton "+ Round" enregistre le round pour tous les mouvements du superset
// en une seule action.
export function SupersetRoundRow({ round, exercises, onUpsertSetLog }) {
  const [editing, setEditing] = useState(false)
  const [inputs, setInputs] = useState(
    exercises.map(e => {
      const log = e.logs?.find(l => l.round_number === round)
      return { reps: log?.reps ?? '', weight: log?.weight_kg ?? '', distance: log?.distance_m ?? '' }
    })
  )

  const updateInput = (idx, field, value) => {
    setInputs(prev => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)))
  }

  const handleSave = async () => {
    await Promise.all(
      exercises.map((e, i) => {
        const inp = inputs[i]
        return onUpsertSetLog(e.id, round, {
          reps: inp.reps ? Number(inp.reps) : null,
          weight_kg: inp.weight ? Number(inp.weight) : null,
          distance_m: inp.distance ? Number(inp.distance) : null,
        })
      })
    )
    setEditing(false)
  }

  return (
    <div className="round-row-wrap">
      <style jsx>{`
        .superset-row { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border: 1px solid rgba(255,255,255,.055); border-radius: 7px; background: rgba(255,255,255,.03); font-size: 10px; color: rgba(255,255,255,.72); }
        .superset-row strong { color: white; margin-right: 2px; }
        .superset-row .plus { color: rgba(255,255,255,.3); padding: 0 4px; }
        .superset-row .vals { flex: 1; display: flex; }
        .edit-round-btn { flex: 0 0 auto; border: 0; color: rgba(255,255,255,.38); background: transparent; font: inherit; font-size: 10px; font-weight: 700; cursor: pointer; }
        .edit-round-btn:hover { color: #FDBA74; }
        .round-edit { padding: 8px; border: 1px solid rgba(249,115,22,.28); border-radius: 8px; background: rgba(249,115,22,.045); }
        .round-edit-label { margin: 0 0 6px; color: #FDBA74; font-size: 9px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
        .round-edit-ex { margin-bottom: 6px; }
        .round-edit-ex:last-of-type { margin-bottom: 0; }
        .round-edit-ex-name { display: block; margin-bottom: 4px; color: rgba(255,255,255,.55); font-size: 9px; font-weight: 700; }
        .round-edit-inputs { display: flex; gap: 6px; }
        .round-edit-inputs input { flex: 1; min-width: 0; box-sizing: border-box; min-height: 30px; padding: 0 8px; border: 1px solid rgba(255,255,255,.08); border-radius: 7px; color: white; background: rgba(255,255,255,.035); font: inherit; font-size: 11px; outline: none; }
        .round-edit-inputs input:focus { border-color: rgba(249,115,22,.65); box-shadow: 0 0 0 3px rgba(249,115,22,.09); }
        .round-edit-actions { display: flex; gap: 8px; margin-top: 8px; }
        .round-edit-actions button { flex: 1; min-height: 30px; border-radius: 7px; font: inherit; font-size: 10px; font-weight: 800; cursor: pointer; border: 1px solid transparent; }
        .cancel-round { color: rgba(255,255,255,.5); background: transparent; border-color: rgba(255,255,255,.12) !important; }
        .save-round { color: #FDBA74; background: rgba(249,115,22,.12); border-color: rgba(249,115,22,.32) !important; }
        .save-round:hover { background: rgba(249,115,22,.2); }
      `}</style>

      {!editing ? (
        <div className="superset-row">
          <strong>R{round}</strong>
          <div className="vals">
            {exercises.map((e, i) => {
              const log = e.logs?.find(l => l.round_number === round)
              const parts = []
              if (log?.reps != null) parts.push(`${log.reps} reps`)
              if (log?.weight_kg) parts.push(`${log.weight_kg} kg`)
              if (log?.distance_m) parts.push(`${log.distance_m} m`)
              return (
                <span key={e.id}>
                  {i > 0 && <span className="plus">+</span>}
                  {parts.length ? parts.join(' · ') : '—'}
                </span>
              )
            })}
          </div>
          <button type="button" className="edit-round-btn" onClick={() => setEditing(true)}>Modifier</button>
        </div>
      ) : (
        <div className="round-edit">
          <p className="round-edit-label">Round {round}</p>
          {exercises.map((e, i) => (
            <div key={e.id} className="round-edit-ex">
              <span className="round-edit-ex-name">{e.exercise?.name}</span>
              <div className="round-edit-inputs">
                <input type="number" min="0" placeholder="Reps" value={inputs[i].reps}
                  onChange={ev => updateInput(i, 'reps', ev.target.value)} inputMode="numeric" />
                <input type="number" min="0" step="0.5" placeholder="kg" value={inputs[i].weight}
                  onChange={ev => updateInput(i, 'weight', ev.target.value)} inputMode="decimal" />
                <input type="number" min="0" placeholder="m" value={inputs[i].distance}
                  onChange={ev => updateInput(i, 'distance', ev.target.value)} inputMode="numeric" />
              </div>
            </div>
          ))}
          <div className="round-edit-actions">
            <button type="button" className="cancel-round" onClick={() => setEditing(false)}>Annuler</button>
            <button type="button" className="save-round" onClick={handleSave}>Enregistrer</button>
          </div>
        </div>
      )}
    </div>
  )
}

export function SupersetGroup({ exercises, onUpsertSetLog, onRemoveExerciseFromBlock }) {
  const maxRounds = Math.max(0, ...exercises.map(e => e.logs?.length || 0))
  const rounds = Array.from({ length: maxRounds }, (_, i) => i + 1)

  const [inputs, setInputs] = useState(
    exercises.map(e => ({
      reps: e.target_reps ?? '',
      weight: e.target_weight_kg ?? '',
      distance: e.target_distance_m ?? '',
    }))
  )

  const updateInput = (idx, field, value) => {
    setInputs(prev => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)))
  }

  const canAdd = inputs.some(inp => inp.reps || inp.distance)

  const handleAddRound = async () => {
    const nextRound = maxRounds + 1
    await Promise.all(
      exercises.map((e, i) => {
        const inp = inputs[i]
        if (!inp.reps && !inp.distance) return null
        return onUpsertSetLog(e.id, nextRound, {
          reps: inp.reps ? Number(inp.reps) : null,
          weight_kg: inp.weight ? Number(inp.weight) : null,
          distance_m: inp.distance ? Number(inp.distance) : null,
        })
      })
    )
  }

  return (
    <div className="superset-group">
      <style jsx>{`
        .superset-group { position: relative; }
        .superset-title { margin: 0 0 8px; font-size: 13px; font-weight: 850; }
        .superset-title .sep { color: rgba(255,255,255,.35); font-weight: 700; padding: 0 6px; }
        .superset-rounds { display: grid; gap: 4px; margin-bottom: 10px; }
        .superset-inputs { display: grid; gap: 10px; }
        .superset-ex-block { border-top: 1px dashed rgba(255,255,255,.07); padding-top: 8px; }
        .superset-ex-block:first-child { border-top: 0; padding-top: 0; }
        .superset-ex-label { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .superset-ex-label span { color: rgba(255,255,255,.55); font-size: 9px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
        .superset-ex-label button { border: 0; color: rgba(255,255,255,.38); background: transparent; font: inherit; font-size: 10px; cursor: pointer; font-weight: 700; }
        .superset-ex-label button:hover { color: #ff8d8d; }
        .superset-ex-inputs { display: flex; gap: 6px; flex-wrap: wrap; }
        .input-group { flex: 1; min-width: 50px; }
        .field-label { display: block; margin-bottom: 3px; color: rgba(255,255,255,.45); font-size: 8px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
        .field-input { width: 100%; box-sizing: border-box; min-height: 32px; padding: 0 8px; border: 1px solid rgba(255,255,255,.08); border-radius: 7px; color: white; background: rgba(255,255,255,.035); font: inherit; font-size: 11px; outline: none; }
        .field-input:focus { border-color: rgba(249,115,22,.65); box-shadow: 0 0 0 3px rgba(249,115,22,.09); }
        .add-set { width: 100%; min-height: 34px; margin-top: 4px; border: 1px solid rgba(249,115,22,.28); border-radius: 8px; color: #FDBA74; background: rgba(249,115,22,.07); font: inherit; font-size: 10px; font-weight: 800; cursor: pointer; transition: .18s ease; }
        .add-set:hover:not(:disabled) { background: rgba(249,115,22,.14); border-color: rgba(249,115,22,.55); }
        .add-set:disabled { opacity: .35; cursor: not-allowed; }
      `}</style>

      <p className="superset-title">
        {exercises.map((e, i) => (
          <span key={e.id}>
            {i > 0 && <span className="sep">+</span>}
            {e.exercise?.name}
          </span>
        ))}
      </p>

      {rounds.length > 0 && (
        <div className="superset-rounds">
          {rounds.map(r => (
            <SupersetRoundRow key={r} round={r} exercises={exercises} onUpsertSetLog={onUpsertSetLog} />
          ))}
        </div>
      )}

      <div className="superset-inputs">
        {exercises.map((e, i) => (
          <div key={e.id} className="superset-ex-block">
            <div className="superset-ex-label">
              <span>{e.exercise?.name}</span>
              <button type="button" onClick={() => onRemoveExerciseFromBlock(e.id)}>Retirer</button>
            </div>
            <div className="superset-ex-inputs">
              <div className="input-group">
                <label className="field-label">Reps</label>
                <input className="field-input" type="number" min="0" value={inputs[i].reps}
                  onChange={ev => updateInput(i, 'reps', ev.target.value)} inputMode="numeric" />
              </div>
              <div className="input-group">
                <label className="field-label">Poids</label>
                <input className="field-input" type="number" min="0" step="0.5" value={inputs[i].weight}
                  onChange={ev => updateInput(i, 'weight', ev.target.value)} placeholder="kg" inputMode="decimal" />
              </div>
              <div className="input-group">
                <label className="field-label">Distance</label>
                <input className="field-input" type="number" min="0" value={inputs[i].distance}
                  onChange={ev => updateInput(i, 'distance', ev.target.value)} placeholder="m" inputMode="numeric" />
              </div>
            </div>
          </div>
        ))}
        <button type="button" className="add-set" onClick={handleAddRound} disabled={!canAdd}>
          ＋ Round {maxRounds + 1} (les deux mouvements)
        </button>
      </div>
    </div>
  )
}

// Affiche un EMOM à plusieurs mouvements de façon minimale : juste le nom et
// la cible de chaque mouvement, une ligne chacun. Aucune liste de rounds —
// le nombre total est déjà dans le sous-titre du bloc ("EMOM 10").
export function EmomGroup({ exercises, onUpsertSetLog, onRemoveExerciseFromBlock }) {
  return (
    <div className="emom-simple">
      <style jsx>{`
        .emom-simple { display: grid; gap: 6px; }
      `}</style>
      {exercises.map(e => (
        <EmomSimpleRow
          key={e.id}
          exercise={e}
          onUpsertSetLog={onUpsertSetLog}
          onRemove={() => onRemoveExerciseFromBlock(e.id)}
        />
      ))}
    </div>
  )
}

function EmomSimpleRow({ exercise, onUpsertSetLog, onRemove }) {
  const log = exercise.logs?.[0]
  const currentReps = log?.reps ?? exercise.target_reps
  const currentWeight = log?.weight_kg ?? exercise.target_weight_kg
  const currentDistance = log?.distance_m ?? exercise.target_distance_m

  const [editing, setEditing] = useState(false)
  const [reps, setReps] = useState(currentReps ?? '')
  const [weight, setWeight] = useState(currentWeight ?? '')
  const [distance, setDistance] = useState(currentDistance ?? '')

  const parts = []
  if (currentReps != null) parts.push(`${currentReps} reps`)
  if (currentWeight) parts.push(`${currentWeight} kg`)
  if (currentDistance) parts.push(`${currentDistance} m`)

  const handleSave = async () => {
    await onUpsertSetLog(exercise.id, 1, {
      reps: reps ? Number(reps) : null,
      weight_kg: weight ? Number(weight) : null,
      distance_m: distance ? Number(distance) : null,
    })
    setEditing(false)
  }

  return (
    <div className="emom-simple-row">
      <style jsx>{`
        .emom-simple-row { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border: 1px solid rgba(255,255,255,.06); border-radius: 9px; background: rgba(255,255,255,.025); flex-wrap: wrap; }
        .name { flex: 1; min-width: 100px; font-size: 12px; font-weight: 800; }
        .value { color: rgba(255,255,255,.75); font-size: 12px; font-weight: 700; }
        .actions { display: flex; gap: 10px; }
        .actions button { border: 0; color: rgba(255,255,255,.4); background: transparent; font: inherit; font-size: 10px; cursor: pointer; font-weight: 700; }
        .actions button:hover { color: #FDBA74; }
        .actions .danger:hover { color: #ff8d8d; }
        .edit-row { display: flex; gap: 6px; align-items: flex-end; flex-wrap: wrap; width: 100%; margin-top: 6px; }
        .input-group { flex: 1; min-width: 50px; }
        .field-label { display: block; margin-bottom: 3px; color: rgba(255,255,255,.45); font-size: 8px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
        .field-input { width: 100%; box-sizing: border-box; min-height: 30px; padding: 0 8px; border: 1px solid rgba(255,255,255,.08); border-radius: 7px; color: white; background: rgba(255,255,255,.035); font: inherit; font-size: 11px; outline: none; }
        .field-input:focus { border-color: rgba(249,115,22,.65); box-shadow: 0 0 0 3px rgba(249,115,22,.09); }
        .save-btn { min-height: 30px; padding: 0 10px; border: 1px solid rgba(249,115,22,.28); border-radius: 7px; color: #FDBA74; background: rgba(249,115,22,.09); font: inherit; font-size: 10px; font-weight: 800; cursor: pointer; }
        .save-btn:hover { background: rgba(249,115,22,.18); }
      `}</style>

      {!editing ? (
        <>
          <span className="name">{exercise.exercise?.name}</span>
          <span className="value">{parts.length ? parts.join(' · ') : '—'}</span>
          <div className="actions">
            <button type="button" onClick={() => setEditing(true)}>Modifier</button>
            <button type="button" className="danger" onClick={onRemove}>Retirer</button>
          </div>
        </>
      ) : (
        <>
          <span className="name">{exercise.exercise?.name}</span>
          <div className="edit-row">
            <div className="input-group">
              <label className="field-label">Reps</label>
              <input className="field-input" type="number" min="0" value={reps}
                onChange={e => setReps(e.target.value)} inputMode="numeric" />
            </div>
            <div className="input-group">
              <label className="field-label">Poids</label>
              <input className="field-input" type="number" min="0" step="0.5" value={weight}
                onChange={e => setWeight(e.target.value)} placeholder="kg" inputMode="decimal" />
            </div>
            <div className="input-group">
              <label className="field-label">Distance</label>
              <input className="field-input" type="number" min="0" value={distance}
                onChange={e => setDistance(e.target.value)} placeholder="m" inputMode="numeric" />
            </div>
            <button type="button" className="save-btn" onClick={handleSave}>OK</button>
          </div>
        </>
      )}
    </div>
  )
}
