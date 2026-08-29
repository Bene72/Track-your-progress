'use client'

import { useState, useEffect } from 'react'
import { MUSCLE_GROUPS } from '../lib/constants'
import {
  BLOCK_TYPES,
  BLOCK_TYPE_LABEL,
  BLOCK_TYPE_ICON,
  ROUNDS_TYPES,
  RESULT_TYPES,
  blockLetter,
  prescriptionLine,
  movementTargetLine,
  defaultMuscleGroup,
} from './personal-session/helpers'
import ExerciseAutocomplete from './personal-session/ExerciseAutocomplete'
import {
  BlockComment,
  AddToBlockInline,
  BlockSettingsForm,
  ResultForm,
  MovementBlock,
  SupersetGroup,
  EmomGroup,
} from './personal-session/BlockParts'

export default function PersonalSessionCard({
  session,
  catalogByMuscle,
  onCreateBlock,
  onDeleteBlock,
  onUpdateBlock,
  onAddExerciseToBlock,
  onRemoveExerciseFromBlock,
  onMoveExerciseToBlock,
  onAddCustomExercise,
  onUpsertSetLog,
  onSetBlockResult,
}) {
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [exerciseQuery, setExerciseQuery] = useState('')
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
  const [editingBlockId, setEditingBlockId] = useState(null)
  const [closedBlockIds, setClosedBlockIds] = useState(() => new Set())

  const toggleBlockOpen = (blockId) => {
    setClosedBlockIds(prev => {
      const next = new Set(prev)
      if (next.has(blockId)) next.delete(blockId)
      else next.add(blockId)
      return next
    })
  }

  const [timeLabel, setTimeLabel] = useState('')
  useEffect(() => {
    setTimeLabel(new Date(session.created_at).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    }))
  }, [session.created_at])

  const blocks = session.blocks || []
  const isNewBlockMode = selectedBlockId === ''
  const sortedCatalog = Object.values(catalogByMuscle).flat().sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  const [pickerResetKey, setPickerResetKey] = useState(0)

  const resetAddForm = () => {
    setSelectedExerciseId('')
    setExerciseQuery('')
    setTargetReps('')
    setTargetWeight('')
    setTargetDistance('')
    setPickerResetKey(k => k + 1)
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

  // Créé un nouvel exercice "à la volée" depuis l'autocomplete (saisie libre)
  // quand le nom tapé ne correspond à rien dans le catalogue : on ne bloque
  // jamais l'utilisateur, on lui affecte juste un groupe musculaire générique
  // par défaut (modifiable plus tard via "+ Exercice perso" si besoin).
  const handleCreateExercise = async (name) => {
    setError(null)
    try {
      return await onAddCustomExercise(name, defaultMuscleGroup())
    } catch (err) {
      setError(err.message)
      return null
    }
  }

  // Bouton "Ajouter" du formulaire principal : si aucun exercice existant
  // n'est sélectionné mais qu'un texte libre a été tapé, on le crée d'abord
  // (groupe musculaire générique par défaut) puis on l'ajoute. Ça marche en
  // un seul clic, sans avoir besoin d'ouvrir/cliquer la liste déroulante.
  const handlePrimaryAdd = async () => {
    if (selectedExerciseId) {
      await handleAddExercise(selectedExerciseId)
      return
    }
    const name = exerciseQuery.trim()
    if (!name) return
    const created = await handleCreateExercise(name)
    if (created) await handleAddExercise(created.id)
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
          align-items: center;
          gap: 10px;
          flex: 1;
          min-width: 0;
          cursor: pointer;
        }

        .block-letter {
          flex: 0 0 auto;
          font-size: 15px;
          font-weight: 900;
          color: white;
        }

        .block-title-text {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 13px;
          font-weight: 850;
          color: #FDBA74;
        }

        .block-tag {
          flex: 0 0 auto;
          padding: 3px 8px;
          border-radius: 7px;
          color: #FDBA74;
          background: rgba(249,115,22,.14);
          border: 1px solid rgba(249,115,22,.3);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .04em;
          text-transform: uppercase;
        }

        .block-chevron {
          flex: 0 0 auto;
          color: rgba(255,255,255,.4);
          font-size: 13px;
          transition: transform .18s ease;
        }

        .block-chevron.open { transform: rotate(90deg); }

        .block-sub { color: rgba(255,255,255,.4); font-size: 9px; font-weight: 600; text-transform: none; letter-spacing: 0; }

        .block-header-actions { display: flex; align-items: center; gap: 14px; flex: 0 0 auto; }

        .block-prescription {
          margin: 2px 4px 10px;
          padding: 10px 12px;
          border: 1px solid rgba(255,255,255,.06);
          border-radius: 10px;
          background: rgba(0,0,0,.18);
        }

        .presc-rule { margin: 0 0 4px; font-size: 12px; font-weight: 850; color: white; }

        .presc-move {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          font-size: 11.5px;
          line-height: 1.6;
          color: rgba(255,255,255,.8);
        }

        .presc-move .tail { color: rgba(255,255,255,.55); text-decoration: underline; text-decoration-color: rgba(255,255,255,.25); text-underline-offset: 2px; white-space: nowrap; }

        .block-body { overflow: hidden; }
        .block-body.closed { display: none; }

        .block-edit {
          border: 0;
          color: rgba(255,255,255,.35);
          background: transparent;
          font: inherit;
          font-size: 11px;
          cursor: pointer;
        }
        .block-edit:hover { color: #FDBA74; }

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
        <ExerciseAutocomplete
          key={pickerResetKey}
          catalog={sortedCatalog}
          value={selectedExerciseId}
          onChange={setSelectedExerciseId}
          onCreateNew={handleCreateExercise}
        />

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
        {blocks.map((block, blockIdx) => {
          const isMulti = block.exercises.length > 1
          const isOpen = !closedBlockIds.has(block.id)
          return (
            <div
              key={block.id}
              className={`block-group ${isMulti ? 'multi' : ''} ${dragOverBlockId === block.id ? 'drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOverBlockId(block.id) }}
              onDragLeave={() => setDragOverBlockId(cur => (cur === block.id ? null : cur))}
              onDrop={e => { e.preventDefault(); handleDrop(block.id) }}
            >
              <div className="block-header">
                <div className="block-title" onClick={() => toggleBlockOpen(block.id)}>
                  <span className="block-letter">{blockLetter(blockIdx)}/</span>
                  <span className="block-title-text">
                    {block.exercises.map(e => e.exercise?.name).join(' + ') || 'Bloc vide'}
                  </span>
                  <span className="block-tag">{BLOCK_TYPE_ICON[block.block_type]} {BLOCK_TYPE_LABEL[block.block_type]}</span>
                  <span className={`block-chevron ${isOpen ? 'open' : ''}`}>›</span>
                </div>
                <div className="block-header-actions">
                  <button
                    type="button"
                    className="block-edit"
                    onClick={() => setEditingBlockId(cur => (cur === block.id ? null : block.id))}
                  >
                    {editingBlockId === block.id ? 'Fermer' : 'Modifier'}
                  </button>
                  <button type="button" className="block-delete" onClick={() => onDeleteBlock(block.id)}>
                    Supprimer le bloc
                  </button>
                </div>
              </div>

              <div className="block-prescription">
                <p className="presc-rule">{prescriptionLine(block)}</p>
                {block.exercises.map(be => {
                  const { main, tail } = movementTargetLine(be)
                  return (
                    <div key={be.id} className="presc-move">
                      <span>{main}</span>
                      {tail && <span className="tail">{tail}</span>}
                    </div>
                  )
                })}
              </div>

              <div className={`block-body ${isOpen ? '' : 'closed'}`}>
                {editingBlockId === block.id && (
                  <BlockSettingsForm
                    block={block}
                    onSave={async vals => {
                      await onUpdateBlock(block.id, vals)
                      setEditingBlockId(null)
                    }}
                    onCancel={() => setEditingBlockId(null)}
                  />
                )}

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

                <BlockComment block={block} onSave={notes => onUpdateBlock(block.id, { notes })} />

                <AddToBlockInline
                  blockId={block.id}
                  catalog={sortedCatalog}
                  onAddExerciseToBlock={onAddExerciseToBlock}
                  onAddCustomExercise={onAddCustomExercise}
                />

                {RESULT_TYPES.has(block.block_type) && (
                  <ResultForm block={block} onSubmit={vals => onSetBlockResult(block.id, vals)} />
                )}
              </div>
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
