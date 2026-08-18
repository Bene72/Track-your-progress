'use client'

import { useState, useEffect } from 'react'
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, REST_OPTIONS } from '../lib/constants'

const BLOCK_TYPES = [
  { value: 'straight_sets', label: 'Séries classiques', icon: '▤' },
  { value: 'superset', label: 'Superset', icon: '🔄' },
  { value: 'emom', label: 'EMOM', icon: '⏱' },
  { value: 'amrap', label: 'AMRAP', icon: '♾' },
  { value: 'for_time', label: 'For Time', icon: '🏁' },
]
const BLOCK_TYPE_LABEL = Object.fromEntries(BLOCK_TYPES.map(b => [b.value, b.label]))
const BLOCK_TYPE_ICON = Object.fromEntries(BLOCK_TYPES.map(b => [b.value, b.icon]))
const ROUNDS_TYPES = new Set(['straight_sets', 'superset', 'emom', 'for_time'])
const RESULT_TYPES = new Set(['amrap', 'for_time'])

function blockSubtitle(block) {
  if (block.block_type === 'emom') return `EMOM ${block.rounds || '?'} (${block.interval_sec || 60}s/round)`
  if (block.block_type === 'amrap') return `AMRAP ${block.time_cap_sec ? Math.round(block.time_cap_sec / 60) + 'min' : ''}`
  if (block.block_type === 'for_time') return `${block.rounds || '?'} rounds for time`
  if (block.block_type === 'superset') return `Superset · ${block.rounds || '?'} rounds`
  return `${block.rounds || '?'} séries`
}

export default function PersonalSessionCard({
  session,
  catalogByMuscle,
  onCreateBlock,
  onDeleteBlock,
  onAddExerciseToBlock,
  onRemoveExerciseFromBlock,
  onMoveExerciseToBlock,
  onAddCustomExercise,
  onUpsertSetLog,
  onSetBlockResult,
}) {
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [selectedBlockId, setSelectedBlockId] = useState('') // '' = nouveau bloc
  const [newBlockType, setNewBlockType] = useState('straight_sets')
  const [newBlockRounds, setNewBlockRounds] = useState('4')
  const [newBlockInterval, setNewBlockInterval] = useState('60')
  const [newBlockTimeCap, setNewBlockTimeCap] = useState('600')
  const [targetReps, setTargetReps] = useState('')
  const [targetWeight, setTargetWeight] = useState('')
  const [targetDistance, setTargetDistance] = useState('')
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customMuscle, setCustomMuscle] = useState(MUSCLE_GROUPS[0].value)
  const [error, setError] = useState(null)
  const [draggedBeId, setDraggedBeId] = useState(null)
  const [dragOverBlockId, setDragOverBlockId] = useState(null)

  const [timeLabel, setTimeLabel] = useState('')
  useEffect(() => {
    setTimeLabel(new Date(session.created_at).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    }))
  }, [session.created_at])

  const blocks = session.blocks || []
  const isNewBlockMode = selectedBlockId === ''

  const resetAddForm = () => {
    setSelectedExerciseId('')
    setTargetReps('')
    setTargetWeight('')
    setTargetDistance('')
  }

  const handleAddExercise = async (exerciseId) => {
    if (!exerciseId) return
    setError(null)
    const opts = {
      targetReps: targetReps ? Number(targetReps) : null,
      targetWeightKg: targetWeight ? Number(targetWeight) : null,
      targetDistanceM: targetDistance ? Number(targetDistance) : null,
    }
    try {
      if (isNewBlockMode) {
        const block = await onCreateBlock(newBlockType, {
          rounds: ROUNDS_TYPES.has(newBlockType) ? Number(newBlockRounds) || null : null,
          intervalSec: newBlockType === 'emom' ? Number(newBlockInterval) || 60 : null,
          timeCapSec: newBlockType === 'amrap' || newBlockType === 'for_time' ? Number(newBlockTimeCap) || null : null,
        })
        await onAddExerciseToBlock(block.id, exerciseId, opts)
      } else {
        await onAddExerciseToBlock(selectedBlockId, exerciseId, opts)
      }
      resetAddForm()
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
      await handleAddExercise(created.id)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDrop = async (targetBlockId) => {
    setDragOverBlockId(null)
    if (!draggedBeId) return
    try {
      await onMoveExerciseToBlock(draggedBeId, targetBlockId)
    } catch (err) {
      setError(err.message)
    }
    setDraggedBeId(null)
  }

  const handleDropNewSuperset = async () => {
    setDragOverBlockId(null)
    if (!draggedBeId) return
    try {
      const block = await onCreateBlock('superset', { rounds: 4 })
      await onMoveExerciseToBlock(draggedBeId, block.id)
    } catch (err) {
      setError(err.message)
    }
    setDraggedBeId(null)
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
          background: linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.025));
          box-shadow: 0 14px 38px rgba(0,0,0,.14);
        }

        .psc-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }

        .psc-title { display: flex; align-items: center; gap: 10px; }

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

        .psc-name { margin: 0; font-size: 15px; font-weight: 850; }

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

        .exercise-select, .custom-input, .custom-select, .block-select, .type-select {
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

        .exercise-select:focus, .custom-input:focus, .custom-select:focus,
        .block-select:focus, .type-select:focus {
          border-color: rgba(249,115,22,.7);
          box-shadow: 0 0 0 3px rgba(249,115,22,.1);
        }

        .row-2, .row-3 {
          display: grid;
          gap: 8px;
          margin-top: 9px;
        }
        .row-2 { grid-template-columns: 1fr 1fr; }
        .row-3 { grid-template-columns: 1fr 1fr 1fr; }

        .target-fields {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-top: 9px;
        }

        .mini-input {
          box-sizing: border-box;
          width: 100%;
          min-height: 38px;
          padding: 0 10px;
          border: 1px solid var(--psc-border);
          border-radius: 9px;
          color: white;
          background: rgba(255,255,255,.04);
          font: inherit;
          font-size: 12px;
          outline: none;
        }

        .mini-input:focus {
          border-color: rgba(249,115,22,.65);
          box-shadow: 0 0 0 3px rgba(249,115,22,.09);
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

        .action:hover:not(:disabled) { background: rgba(255,255,255,.07); border-color: rgba(255,255,255,.16); }

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

        .block-list { display: grid; gap: 12px; margin-top: 16px; }

        .block-group {
          border: 1px solid var(--psc-border);
          border-radius: 14px;
          padding: 10px;
          background: rgba(255,255,255,.02);
          transition: .18s ease;
        }

        .block-group.multi {
          border-color: rgba(249,115,22,.22);
          background: rgba(249,115,22,.04);
        }

        .block-group.drag-over {
          border-color: rgba(249,115,22,.75);
          background: rgba(249,115,22,.1);
        }

        .block-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 2px 4px 8px;
        }

        .block-title {
          display: flex;
          align-items: baseline;
          gap: 8px;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .07em;
          color: #FDBA74;
        }

        .block-sub { color: rgba(255,255,255,.4); font-size: 9px; font-weight: 600; text-transform: none; letter-spacing: 0; }

        .block-delete {
          border: 0;
          color: rgba(255,255,255,.35);
          background: transparent;
          font: inherit;
          font-size: 11px;
          cursor: pointer;
        }
        .block-delete:hover { color: #ff8d8d; }

        .exercise-item {
          padding: 8px 10px;
          margin-bottom: 4px;
          border-radius: 8px;
          background: rgba(255,255,255,.03);
          cursor: grab;
          transition: .18s ease;
        }
        .exercise-item:last-child { margin-bottom: 0; }
        .exercise-item.dragging { opacity: .4; border: 1px dashed rgba(249,115,22,.4); }

        .empty {
          padding: 22px 12px;
          border: 1px dashed var(--psc-border);
          border-radius: 14px;
          color: var(--psc-muted);
          text-align: center;
          font-size: 12px;
        }

        .new-superset-zone {
          margin-top: 4px;
          border: 1px dashed rgba(249,115,22,.25);
          border-radius: 10px;
          padding: 10px;
          text-align: center;
          color: rgba(255,255,255,.35);
          font-size: 11px;
          transition: .18s ease;
        }
        .new-superset-zone.drag-over {
          border-color: rgba(249,115,22,.65);
          background: rgba(249,115,22,.07);
          color: rgba(255,255,255,.65);
        }

        .result-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-top: 6px;
          padding-top: 8px;
          border-top: 1px solid rgba(255,255,255,.06);
        }

        @media (max-width: 520px) {
          .psc-card { padding: 15px; border-radius: 18px; }
          .action-row, .row-2, .row-3 { grid-template-columns: 1fr; }
          .target-fields { grid-template-columns: 1fr 1fr; }
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
        <label className="label">Exercice</label>
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

        <label className="label" style={{ marginTop: 10 }}>Destination</label>
        <select
          className="block-select"
          value={selectedBlockId}
          onChange={e => setSelectedBlockId(e.target.value)}
        >
          <option value="">＋ Nouveau bloc</option>
          {blocks.map(b => (
            <option key={b.id} value={b.id}>
              {BLOCK_TYPE_ICON[b.block_type]} {BLOCK_TYPE_LABEL[b.block_type]} — {b.exercises.map(e => e.exercise?.name).join(' + ') || '(vide)'}
            </option>
          ))}
        </select>

        {isNewBlockMode && (
          <>
            <div className={newBlockType === 'emom' ? 'row-3' : 'row-2'}>
              <div>
                <label className="label">Type de bloc</label>
                <select className="type-select" value={newBlockType} onChange={e => setNewBlockType(e.target.value)}>
                  {BLOCK_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                </select>
              </div>
              {ROUNDS_TYPES.has(newBlockType) && (
                <div>
                  <label className="label">{newBlockType === 'emom' ? 'Durée (min)' : 'Rounds'}</label>
                  <input className="mini-input" type="number" min="1" value={newBlockRounds}
                    onChange={e => setNewBlockRounds(e.target.value)} />
                </div>
              )}
              {(newBlockType === 'amrap' || newBlockType === 'for_time') && (
                <div>
                  <label className="label">Time cap (sec)</label>
                  <input className="mini-input" type="number" min="1" value={newBlockTimeCap}
                    onChange={e => setNewBlockTimeCap(e.target.value)} />
                </div>
              )}
              {newBlockType === 'emom' && (
                <div>
                  <label className="label">Intervalle (sec)</label>
                  <input className="mini-input" type="number" min="1" value={newBlockInterval}
                    onChange={e => setNewBlockInterval(e.target.value)} />
                </div>
              )}
            </div>
          </>
        )}

        <label className="label" style={{ marginTop: 10 }}>Cible (optionnel)</label>
        <div className="target-fields">
          <input className="mini-input" type="number" placeholder="Reps" value={targetReps}
            onChange={e => setTargetReps(e.target.value)} inputMode="numeric" />
          <input className="mini-input" type="number" placeholder="Poids (kg)" value={targetWeight}
            onChange={e => setTargetWeight(e.target.value)} inputMode="decimal" step="0.5" />
          <input className="mini-input" type="number" placeholder="Distance (m)" value={targetDistance}
            onChange={e => setTargetDistance(e.target.value)} inputMode="numeric" />
        </div>

        <div className="action-row">
          <button type="button" className="action" onClick={() => setShowCustomForm(v => !v)}>
            {showCustomForm ? 'Annuler' : '＋ Exercice perso'}
          </button>
          <button
            type="button"
            className="action primary"
            onClick={() => handleAddExercise(selectedExerciseId)}
            disabled={!selectedExerciseId}
          >
            Ajouter
          </button>
        </div>

        {showCustomForm && (
          <form onSubmit={handleAddCustom} className="custom-form">
            <div>
              <label className="label">Nom de l&apos;exercice</label>
              <input className="custom-input" value={customName} onChange={e => setCustomName(e.target.value)}
                placeholder="Ex. Développé Arnold" maxLength={80} required />
            </div>
            <div>
              <label className="label">Zone travaillée</label>
              <select className="custom-select" value={customMuscle} onChange={e => setCustomMuscle(e.target.value)}>
                {MUSCLE_GROUPS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <button type="submit" className="action primary">Créer et ajouter</button>
          </form>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="block-list">
        {blocks.map(block => {
          const isMulti = block.exercises.length > 1
          return (
            <div
              key={block.id}
              className={`block-group ${isMulti ? 'multi' : ''} ${dragOverBlockId === block.id ? 'drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOverBlockId(block.id) }}
              onDragLeave={() => setDragOverBlockId(cur => (cur === block.id ? null : cur))}
              onDrop={e => { e.preventDefault(); handleDrop(block.id) }}
            >
              <div className="block-header">
                <div className="block-title">
                  {BLOCK_TYPE_ICON[block.block_type]} {BLOCK_TYPE_LABEL[block.block_type]}
                  <span className="block-sub">{blockSubtitle(block)}</span>
                </div>
                <button type="button" className="block-delete" onClick={() => onDeleteBlock(block.id)}>
                  Supprimer le bloc
                </button>
              </div>

              {block.block_type === 'superset' && block.exercises.length > 1 ? (
                <SupersetGroup
                  exercises={block.exercises}
                  onUpsertSetLog={onUpsertSetLog}
                  onRemoveExerciseFromBlock={onRemoveExerciseFromBlock}
                />
              ) : block.block_type === 'emom' && block.exercises.length > 1 ? (
                <EmomGroup
                  exercises={block.exercises}
                  onUpsertSetLog={onUpsertSetLog}
                  onRemoveExerciseFromBlock={onRemoveExerciseFromBlock}
                />
              ) : (
                block.exercises.map(be => (
                  <div
                    key={be.id}
                    className={`exercise-item ${draggedBeId === be.id ? 'dragging' : ''}`}
                    draggable
                    onDragStart={() => setDraggedBeId(be.id)}
                    onDragEnd={() => setDraggedBeId(null)}
                  >
                    <MovementBlock
                      blockExercise={be}
                      blockType={block.block_type}
                      onUpsertSetLog={(round, payload) => onUpsertSetLog(be.id, round, payload)}
                      onRemove={() => onRemoveExerciseFromBlock(be.id)}
                    />
                  </div>
                ))
              )}

              {block.exercises.length === 0 && (
                <div className="empty" style={{ padding: 14 }}>Aucun mouvement dans ce bloc.</div>
              )}

              {RESULT_TYPES.has(block.block_type) && (
                <ResultForm block={block} onSubmit={vals => onSetBlockResult(block.id, vals)} />
              )}
            </div>
          )
        })}

        {draggedBeId && (
          <div
            className={`new-superset-zone ${dragOverBlockId === 'NEW' ? 'drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOverBlockId('NEW') }}
            onDragLeave={() => setDragOverBlockId(cur => (cur === 'NEW' ? null : cur))}
            onDrop={e => { e.preventDefault(); handleDropNewSuperset() }}
          >
            Déposer ici pour créer un nouveau superset
          </div>
        )}

        {blocks.length === 0 && (
          <div className="empty">Aucun bloc dans cette séance pour l&apos;instant.</div>
        )}
      </div>
    </div>
  )
}

function ResultForm({ block, onSubmit }) {
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

function MovementBlock({ blockExercise, blockType, onUpsertSetLog, onRemove }) {
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
        .set-row { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 8px; padding: 5px 8px; border: 1px solid rgba(255,255,255,.055); border-radius: 7px; background: rgba(255,255,255,.03); font-size: 10px; }
        .set-main { display: flex; flex-wrap: wrap; gap: 4px 8px; color: rgba(255,255,255,.68); }
        .set-main strong { color: white; }
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
            <div key={l.id} className="set-row">
              <div className="set-main">
                <span><strong>R{l.round_number}</strong></span>
                {l.reps != null && <span>{l.reps} reps</span>}
                {l.weight_kg ? <span>{l.weight_kg} kg</span> : null}
                {l.distance_m ? <span>{l.distance_m} m</span> : null}
                {l.rest_sec ? <span>{REST_OPTIONS.find(r => Number(r.value) === l.rest_sec)?.label || `${l.rest_sec}s`}</span> : null}
                {l.rpe ? <span>RPE {l.rpe}</span> : null}
              </div>
            </div>
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
function SupersetGroup({ exercises, onUpsertSetLog, onRemoveExerciseFromBlock }) {
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
        .superset-row { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border: 1px solid rgba(255,255,255,.055); border-radius: 7px; background: rgba(255,255,255,.03); font-size: 10px; color: rgba(255,255,255,.72); }
        .superset-row strong { color: white; margin-right: 2px; }
        .superset-row .plus { color: rgba(255,255,255,.3); padding: 0 4px; }
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
            <div key={r} className="superset-row">
              <strong>R{r}</strong>
              {exercises.map((e, i) => {
                const log = e.logs?.find(l => l.round_number === r)
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
function EmomGroup({ exercises, onUpsertSetLog, onRemoveExerciseFromBlock }) {
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
