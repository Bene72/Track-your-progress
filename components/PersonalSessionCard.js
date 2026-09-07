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
import BoxChat from './BoxChat'
import { useBox } from '../lib/hooks/useBox'
import {
  BlockComment,
  SessionNotes,
  AddToBlockInline,
  BlockSettingsForm,
  ResultForm,
  MovementBlock,
  SupersetGroup,
  EmomGroup,
} from './personal-session/BlockParts'

export default function PersonalSessionCard({
  session,
  userId,
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
  onUpdateSessionNotes,
  onFetchLastPerformance,
  onReorderBlocks,
  onDuplicateSession,
  templates,
  onSaveAsTemplate,
  onApplyTemplate,
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
  const [addingExercise, setAddingExercise] = useState(false)
  const [draggedBeId, setDraggedBeId] = useState(null)
  const [dragOverBlockId, setDragOverBlockId] = useState(null)
  const [draggedBlockId, setDraggedBlockId] = useState(null)
  const [editingBlockId, setEditingBlockId] = useState(null)
  const [openBlockIds, setOpenBlockIds] = useState(() => new Set())
  const [showDuplicate, setShowDuplicate] = useState(false)
  const [duplicateDate, setDuplicateDate] = useState('')
  const [duplicating, setDuplicating] = useState(false)
  const [showTemplateMenu, setShowTemplateMenu] = useState(false)
  const [templateBusy, setTemplateBusy] = useState(false)
  const [showSessionChat, setShowSessionChat] = useState(false)
  const box = useBox()

  // Dès qu'un mouvement existant est choisi dans le formulaire principal, on
  // pré-remplit reps/poids/distance avec la dernière perf connue sur ce
  // mouvement (même logique que dans AddToBlockInline, pour le premier
  // ajout d'un bloc).
  useEffect(() => {
    let cancelled = false
    async function prefill() {
      if (!selectedExerciseId || !onFetchLastPerformance) return
      const last = await onFetchLastPerformance(selectedExerciseId)
      if (cancelled || !last) return
      setTargetReps(prev => prev || (last.reps != null ? String(last.reps) : ''))
      setTargetWeight(prev => prev || (last.weight_kg != null ? String(last.weight_kg) : ''))
      setTargetDistance(prev => prev || (last.distance_m != null ? String(last.distance_m) : ''))
    }
    prefill()
    return () => { cancelled = true }
  }, [selectedExerciseId, onFetchLastPerformance])

  const toggleBlockOpen = (blockId) => {
    setOpenBlockIds(prev => {
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
  const totalExercises = blocks.reduce((sum, b) => sum + (b.exercises?.length || 0), 0)
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
    if (!exerciseId || addingExercise) return
    setError(null)
    setAddingExercise(true)
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
        setOpenBlockIds(prev => new Set(prev).add(block.id))
      } else {
        await onAddExerciseToBlock(selectedBlockId, exerciseId, opts)
        setOpenBlockIds(prev => new Set(prev).add(selectedBlockId))
      }
      resetAddForm()
    } catch (err) {
      setError(err.message)
    } finally {
      setAddingExercise(false)
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
    if (addingExercise) return
    if (selectedExerciseId) {
      await handleAddExercise(selectedExerciseId)
      return
    }
    const name = exerciseQuery.trim()
    if (!name) return
    setAddingExercise(true)
    try {
      const created = await handleCreateExercise(name)
      if (!created) return
      // handleAddExercise gère elle-même la suite du cycle addingExercise.
      setAddingExercise(false)
      await handleAddExercise(created.id)
    } finally {
      setAddingExercise(false)
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

  // Réordonne les blocs par drag & drop (poignée dédiée dans le header du
  // bloc, distincte du drag de mouvement entre blocs pour ne pas se marcher
  // dessus).
  const handleBlockDrop = async (targetBlockId) => {
    setDragOverBlockId(null)
    if (!draggedBlockId || draggedBlockId === targetBlockId) { setDraggedBlockId(null); return }
    const ids = blocks.map(b => b.id)
    const fromIdx = ids.indexOf(draggedBlockId)
    const toIdx = ids.indexOf(targetBlockId)
    if (fromIdx === -1 || toIdx === -1) { setDraggedBlockId(null); return }
    const reordered = [...ids]
    reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, draggedBlockId)
    setDraggedBlockId(null)
    try {
      await onReorderBlocks(session.id, reordered)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDuplicate = async () => {
    if (!duplicateDate) return
    setDuplicating(true)
    setError(null)
    try {
      await onDuplicateSession(session.id, duplicateDate)
      setShowDuplicate(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setDuplicating(false)
    }
  }

  const handleSaveTemplate = async () => {
    const name = window.prompt('Nom du modèle (ex. "Push day", "Full body A")')
    if (!name || !name.trim()) return
    setTemplateBusy(true)
    setError(null)
    try {
      await onSaveAsTemplate(session.id, name.trim())
      setShowTemplateMenu(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setTemplateBusy(false)
    }
  }

  const handleApplyTemplate = async (templateId) => {
    setTemplateBusy(true)
    setError(null)
    try {
      await onApplyTemplate(templateId, session.id)
      setShowTemplateMenu(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setTemplateBusy(false)
    }
  }

  return (
    <div className="psc-card">
      <style jsx>{`
        .psc-card {
          --psc-accent: var(--rx, #F97316);
          --psc-border: rgba(255,255,255,.09);
          --psc-muted: rgba(255,255,255,.52);
          max-width: 100%;
          box-sizing: border-box;
          padding: 20px;
          border: 1px solid var(--psc-border);
          border-radius: 22px;
          background: linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.025));
          box-shadow: 0 14px 38px rgba(0,0,0,.14);
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
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

        .psc-count {
          margin: 3px 0 0;
          color: var(--psc-muted);
          font-size: 10.5px;
          font-weight: 700;
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

        .exercise-select, .custom-input, .custom-select, .block-select, .type-select {
          width: 100%;
          min-width: 0;
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

        .block-select, .type-select {
          text-overflow: ellipsis;
          white-space: nowrap;
          overflow: hidden;
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
        .row-2 > div, .row-3 > div { min-width: 0; }

        /* Reps/Poids n'ont jamais besoin de beaucoup de place (2-4 chiffres) :
           on leur laisse une colonne plus étroite et on donne l'espace gagné
           à Distance, pour que la ligne complète tienne sans déborder sur mobile. */
        .target-fields {
          display: grid;
          grid-template-columns: 0.8fr 0.8fr 1.2fr;
          gap: 8px;
          margin-top: 9px;
        }

        .mini-input {
          box-sizing: border-box;
          width: 100%;
          min-width: 0;
          min-height: 38px;
          padding: 0 8px;
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
          flex-wrap: wrap;
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
          white-space: nowrap;
        }

        .block-chevron {
          flex: 0 0 auto;
          color: rgba(255,255,255,.4);
          font-size: 13px;
          transition: transform .18s ease;
        }

        .block-chevron.open { transform: rotate(90deg); }

        .block-sub { color: rgba(255,255,255,.4); font-size: 9px; font-weight: 600; text-transform: none; letter-spacing: 0; }

        .block-header-actions { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; }

        .block-prescription {
          margin: 2px 4px 10px;
          padding: 10px 12px;
          border: 1px solid rgba(255,255,255,.06);
          border-radius: 10px;
          background: rgba(0,0,0,.18);
        }

        .presc-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
        .presc-head .presc-rule { flex: 1; min-width: 0; }
        .presc-count { flex: 0 0 auto; color: rgba(255,255,255,.4); font-size: 9.5px; font-weight: 700; white-space: nowrap; }
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

        .icon-btn {
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          width: 30px;
          height: 30px;
          border: 1px solid var(--psc-border);
          border-radius: 9px;
          color: rgba(255,255,255,.55);
          background: rgba(255,255,255,.03);
          font-size: 13px;
          line-height: 1;
          cursor: pointer;
          transition: .18s ease;
        }
        .icon-btn:hover { color: white; background: rgba(255,255,255,.08); }
        .icon-btn.danger:hover { color: #ff8d8d; background: rgba(255,92,92,.1); border-color: rgba(255,92,92,.3); }

        .psc-toolbar { display: flex; gap: 8px; margin: 10px 0; }
        .psc-toolbar-btn { flex: 1; min-height: 34px; border: 1px solid var(--psc-border); border-radius: 10px; color: rgba(255,255,255,.7); background: rgba(255,255,255,.03); font: inherit; font-size: 11.5px; font-weight: 800; cursor: pointer; transition: .18s ease; }
        .psc-toolbar-btn:hover { color: #FDBA74; border-color: rgba(249,115,22,.4); background: rgba(249,115,22,.08); }
        .psc-panel { margin-bottom: 12px; padding: 12px; border: 1px solid var(--psc-border); border-radius: 12px; background: rgba(255,255,255,.02); }
        .psc-panel-row { display: flex; gap: 8px; margin-top: 6px; }
        .psc-panel-row .mini-input { flex: 1; }
        .psc-panel-hint { margin-top: 8px; color: rgba(255,255,255,.4); font-size: 10.5px; }
        .psc-template-list { display: grid; gap: 6px; margin-top: 6px; }
        .psc-template-item { display: flex; justify-content: space-between; gap: 8px; min-height: 36px; padding: 0 10px; border: 1px solid var(--psc-border); border-radius: 9px; color: white; background: rgba(255,255,255,.03); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; text-align: left; }
        .psc-template-item:hover:not(:disabled) { border-color: rgba(249,115,22,.4); background: rgba(249,115,22,.08); }
        .psc-template-item:disabled { opacity: .5; cursor: default; }
        .psc-template-count { color: rgba(255,255,255,.4); font-weight: 600; font-size: 11px; }

        .block-drag-handle { cursor: grab; color: rgba(255,255,255,.35); padding: 0 2px; }
        .block-drag-handle:hover { color: #FDBA74; }
        .block-group.block-dragging { opacity: .45; border-style: dashed !important; border-color: rgba(249,115,22,.5) !important; }

        
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
        }
      `}</style>

      <div className="psc-head">
        <div className="psc-title">
          <div className="psc-icon">▦</div>
          <div>
            <p className="psc-kicker">Session</p>
            <p className="psc-name">Entraînement personnel</p>
            <p className="psc-count">
              {blocks.length} bloc{blocks.length !== 1 ? 's' : ''} · {totalExercises} exercice{totalExercises !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {timeLabel && <span className="psc-time">{timeLabel}</span>}
      </div>

      <div className="psc-toolbar">
        <button type="button" className="psc-toolbar-btn" onClick={() => { setShowDuplicate(v => !v); setShowTemplateMenu(false) }}>
          📋 Dupliquer
        </button>
        <button type="button" className="psc-toolbar-btn" onClick={() => { setShowTemplateMenu(v => !v); setShowDuplicate(false) }}>
          🧩 Modèles
        </button>
        <button type="button" className="psc-toolbar-btn" onClick={() => setShowSessionChat(v => !v)}>
          💬 Discussion
        </button>
      </div>

      {showDuplicate && (
        <div className="psc-panel">
          <label className="label">Dupliquer cette séance vers…</label>
          <div className="psc-panel-row">
            <input className="mini-input" type="date" value={duplicateDate} onChange={e => setDuplicateDate(e.target.value)} />
            <button type="button" className="action primary" onClick={handleDuplicate} disabled={!duplicateDate || duplicating}>
              {duplicating ? '...' : 'Dupliquer'}
            </button>
          </div>
          <p className="psc-panel-hint">La structure (blocs, mouvements, cibles) est copiée. Les logs déjà réalisés ne le sont pas.</p>
        </div>
      )}

      {showTemplateMenu && (
        <div className="psc-panel">
          <button type="button" className="action primary" style={{ width: '100%', marginBottom: 8 }} onClick={handleSaveTemplate} disabled={templateBusy || blocks.length === 0}>
            💾 Enregistrer cette séance comme modèle
          </button>
          {templates?.length > 0 && (
            <>
              <label className="label">Charger un modèle existant</label>
              <div className="psc-template-list">
                {templates.map(t => (
                  <button key={t.id} type="button" className="psc-template-item" onClick={() => handleApplyTemplate(t.id)} disabled={templateBusy}>
                    <span>{t.name}</span>
                    <span className="psc-template-count">{t.blocks.length} bloc{t.blocks.length !== 1 ? 's' : ''}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <SessionNotes session={session} onSave={notes => onUpdateSessionNotes(session.id, notes)} />

      {showSessionChat && box.activeBoxId && (
        <div style={{ marginBottom: 12 }}>
          <BoxChat
            boxId={box.activeBoxId}
            userId={userId}
            sessionId={session.id}
            title="💬 Discussion sur cette séance (visible par ton coach)"
            height={320}
          />
        </div>
      )}

      <div className="add-area">
        <label className="label">Exercice</label>
        <ExerciseAutocomplete
          key={pickerResetKey}
          catalog={sortedCatalog}
          value={selectedExerciseId}
          onChange={setSelectedExerciseId}
          onCreateNew={handleCreateExercise}
          onQueryChange={setExerciseQuery}
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
            onClick={handlePrimaryAdd}
            disabled={addingExercise || (!selectedExerciseId && !exerciseQuery.trim())}
          >
            {addingExercise ? 'Ajout…' : (!selectedExerciseId && exerciseQuery.trim() ? '＋ Créer et ajouter' : 'Ajouter')}
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
          const isOpen = openBlockIds.has(block.id)
          return (
            <div
              key={block.id}
              className={`block-group ${isMulti ? 'multi' : ''} ${dragOverBlockId === block.id ? 'drag-over' : ''} ${draggedBlockId === block.id ? 'block-dragging' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOverBlockId(block.id) }}
              onDragLeave={() => setDragOverBlockId(cur => (cur === block.id ? null : cur))}
              onDrop={e => { e.preventDefault(); draggedBlockId ? handleBlockDrop(block.id) : handleDrop(block.id) }}
            >
              <div className="block-header">
                <div
                  className="block-title"
                  onClick={() => toggleBlockOpen(block.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggleBlockOpen(block.id)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isOpen}
                >
                  <span
                    className="block-drag-handle"
                    draggable
                    onClick={e => e.stopPropagation()}
                    onDragStart={e => { e.stopPropagation(); setDraggedBlockId(block.id) }}
                    onDragEnd={() => setDraggedBlockId(null)}
                    title="Glisser pour réordonner"
                  >
                    ⠿
                  </span>
                  <span className="block-letter">{blockLetter(blockIdx)}/</span>
                  <span className="block-title-text">
                    {block.exercises.map(e => e.exercise?.name).join(' + ') || 'Bloc vide'}
                  </span>
                  <span className="block-tag" title={BLOCK_TYPE_LABEL[block.block_type]}>
                    {BLOCK_TYPE_ICON[block.block_type]}
                  </span>
                  <span className={`block-chevron ${isOpen ? 'open' : ''}`}>›</span>
                </div>
                <div className="block-header-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setEditingBlockId(cur => (cur === block.id ? null : block.id))}
                    aria-label={editingBlockId === block.id ? 'Fermer les réglages du bloc' : 'Modifier le bloc'}
                    title={editingBlockId === block.id ? 'Fermer' : 'Modifier'}
                  >
                    {editingBlockId === block.id ? '✕' : '✎'}
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    onClick={() => onDeleteBlock(block.id)}
                    aria-label="Supprimer le bloc"
                    title="Supprimer le bloc"
                  >
                    🗑
                  </button>
                </div>
              </div>

              <div className="block-prescription">
                <div className="presc-head">
                  <p className="presc-rule">{prescriptionLine(block)}</p>
                  <span className="presc-count">
                    {block.exercises.length} mouvement{block.exercises.length !== 1 ? 's' : ''}
                  </span>
                </div>
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
                    userId={userId}
                    onUpsertSetLog={onUpsertSetLog}
                    onRemoveExerciseFromBlock={onRemoveExerciseFromBlock}
                  />
                ) : block.block_type === 'emom' && block.exercises.length > 1 ? (
                  <EmomGroup
                    exercises={block.exercises}
                    userId={userId}
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
                        userId={userId}
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
                  onFetchLastPerformance={onFetchLastPerformance}
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
