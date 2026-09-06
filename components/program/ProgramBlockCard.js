'use client'
import { useState } from 'react'
import ExerciseActionsMenu from '../personal-session/ExerciseActionsMenu'
import BoxChat from '../BoxChat'
import AutoLoadPanel from './AutoLoadPanel'
import { BLOCK_TYPES, getBlockType } from '../../lib/blockTypes'

const STATUS_LABELS = { pending: 'À faire', done: '✅ Fait', skipped: '⏭ Passé' }

export default function ProgramBlockCard({
  block, letter, canEdit, isAthleteView, userId, athleteId, boxId,
  onUpdateBlock, onDeleteBlock, onUpsertLog,
}) {
  const [editing, setEditing] = useState(false)
  const [blockType, setBlockType] = useState(block.block_type || 'exercise')
  const [title, setTitle] = useState(block.title)
  const [prescription, setPrescription] = useState(block.prescription || '')
  const [notes, setNotes] = useState(block.notes || '')
  const [percent1rm, setPercent1rm] = useState(block.percent_1rm ?? '')
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState(block.myLog?.athlete_note || '')
  const [showChat, setShowChat] = useState(false)

  const status = block.myLog?.status || 'pending'
  const typeInfo = getBlockType(block.block_type)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onUpdateBlock(block.id, { blockType, title, prescription, notes, percent1rm: percent1rm === '' ? null : Number(percent1rm) })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleDone = async () => {
    await onUpsertLog(block.id, { status: status === 'done' ? 'pending' : 'done', athlete_note: note })
  }

  const handleSaveNote = async () => {
    await onUpsertLog(block.id, { status, athlete_note: note })
  }

  // Pour brancher le menu "vidéo/historique/PR" même sur un bloc sans
  // exercice lié au catalogue (juste un video_url ponctuel du coach).
  const menuExercise = block.exercise || (block.video_url ? { id: block.id, name: block.title, video_url: block.video_url } : null)

  return (
    <div className="pbcard">
      <style jsx>{`
        .pbcard { border: 1px solid rgba(255,255,255,.09); border-radius: 14px; padding: 14px; margin-bottom: 12px; background: rgba(255,255,255,.02); }
        .pbcard-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 8px; }
        .pbcard-title { font-size: 14px; font-weight: 800; }
        .pbcard-letter { color: #FDBA74; margin-right: 4px; }
        .pbcard-prescription { font-size: 13px; color: #E8E5DC; white-space: pre-wrap; margin-bottom: 8px; }
        .pbcard-notes { font-size: 12px; color: rgba(255,255,255,.55); font-style: italic; white-space: pre-wrap; margin-bottom: 10px; padding: 8px 10px; border-radius: 10px; background: rgba(255,255,255,.03); }
        .pbcard-actions { display: flex; gap: 6px; flex-wrap: wrap; }
        .pbcard-btn { min-height: 30px; padding: 0 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.03); color: rgba(255,255,255,.7); font: inherit; font-size: 11px; font-weight: 700; cursor: pointer; }
        .pbcard-btn:hover { color: white; border-color: rgba(249,115,22,.4); }
        .pbcard-btn.primary { background: linear-gradient(135deg, #F97316, #C2410C); color: white; border: none; }
        .pbcard-btn.danger:hover { color: #ff8d8d; border-color: rgba(255,92,92,.4); }
        .pbcard-status { font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 999px; background: rgba(255,255,255,.06); }
        .pbcard-status.done { background: rgba(74,222,128,.15); color: #86efac; }
        .pbcard-edit-field { width: 100%; box-sizing: border-box; margin-bottom: 8px; padding: 8px 10px; border: 1px solid rgba(255,255,255,.1); border-radius: 10px; color: white; background: rgba(255,255,255,.04); font: inherit; font-size: 12.5px; outline: none; }
        .pbcard-pct-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
        .pbcard-pct-label { font-size: 11px; color: rgba(255,255,255,.5); flex: 1; }
        .pbcard-pct-input { width: 60px; box-sizing: border-box; padding: 6px 8px; border: 1px solid rgba(255,255,255,.1); border-radius: 8px; color: white; background: rgba(255,255,255,.04); font: inherit; font-size: 12.5px; outline: none; }
        .pbcard-note-area { width: 100%; box-sizing: border-box; min-height: 60px; margin-top: 8px; padding: 8px 10px; border: 1px solid rgba(255,255,255,.1); border-radius: 10px; color: white; background: rgba(255,255,255,.04); font: inherit; font-size: 12.5px; outline: none; resize: vertical; }
        .pbcard-title { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
        .pbcard-type-badge { display: inline-flex; align-items: center; gap: 3px; padding: 2px 7px; border-radius: 999px; border: 1px solid; font-size: 10px; font-weight: 800; }
        .pbcard-types { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
        .pbcard-type { display: inline-flex; align-items: center; gap: 5px; padding: 6px 10px; border-radius: 999px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.04); color: rgba(255,255,255,.6); font: inherit; font-size: 11.5px; font-weight: 700; cursor: pointer; }
        .pbcard-type.active { color: #16110D; border-color: transparent; }
      `}</style>

      {editing ? (
        <>
          <div className="pbcard-types">
            {BLOCK_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                className={`pbcard-type ${blockType === t.value ? 'active' : ''}`}
                style={blockType === t.value ? { background: t.color } : undefined}
                onClick={() => setBlockType(t.value)}
              >
                <span>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
          <input className="pbcard-edit-field" value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre du bloc" />
          <textarea className="pbcard-edit-field" rows={2} value={prescription} onChange={e => setPrescription(e.target.value)} placeholder="Prescription (ex. 5x5, tempo 32X1)" />
          <div className="pbcard-pct-row">
            <span className="pbcard-pct-label">% du 1RM (optionnel — calcule la charge auto)</span>
            <input className="pbcard-pct-input" type="number" min="1" max="200" step="1" value={percent1rm} onChange={e => setPercent1rm(e.target.value)} placeholder="ex. 75" />
          </div>
          <textarea className="pbcard-edit-field" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Note du coach" />
          <div className="pbcard-actions">
            <button type="button" className="pbcard-btn primary" onClick={handleSave} disabled={saving}>{saving ? '...' : 'Enregistrer'}</button>
            <button type="button" className="pbcard-btn" onClick={() => setEditing(false)}>Annuler</button>
          </div>
        </>
      ) : (
        <>
          <div className="pbcard-head">
            <div className="pbcard-title">
              <span className="pbcard-type-badge" style={{ color: typeInfo.color, borderColor: `${typeInfo.color}55` }}>{typeInfo.icon} {typeInfo.label}</span>
              <span className="pbcard-letter">{letter}/</span>{block.title}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {isAthleteView && <span className={`pbcard-status ${status === 'done' ? 'done' : ''}`}>{STATUS_LABELS[status]}</span>}
              {menuExercise && <ExerciseActionsMenu exercise={menuExercise} userId={userId} />}
            </div>
          </div>
          {block.prescription && <div className="pbcard-prescription">{block.prescription}</div>}
          {block.notes && <div className="pbcard-notes">💬 {block.notes}</div>}

          {block.percent_1rm && block.exercise?.name && (isAthleteView || canEdit) && (
            <AutoLoadPanel athleteId={athleteId} canEditRM={isAthleteView} exerciseName={block.exercise.name} percent={block.percent_1rm} />
          )}

          {isAthleteView && (
            <>
              <textarea
                className="pbcard-note-area"
                value={note}
                onChange={e => setNote(e.target.value)}
                onBlur={handleSaveNote}
                placeholder="Note pour le coach (ressenti, charges réelles, douleur...)"
              />
              <div className="pbcard-actions" style={{ marginTop: 8 }}>
                <button type="button" className={`pbcard-btn ${status === 'done' ? '' : 'primary'}`} onClick={handleToggleDone}>
                  {status === 'done' ? 'Marquer à faire' : 'Terminer'}
                </button>
                <button type="button" className="pbcard-btn" onClick={() => setShowChat(v => !v)}>💬 Discussion</button>
              </div>
            </>
          )}

          {canEdit && (
            <div className="pbcard-actions" style={{ marginTop: isAthleteView ? 8 : 0 }}>
              <button type="button" className="pbcard-btn" onClick={() => setEditing(true)}>Modifier</button>
              <button type="button" className="pbcard-btn danger" onClick={() => onDeleteBlock(block.id)}>Retirer</button>
              {!isAthleteView && <button type="button" className="pbcard-btn" onClick={() => setShowChat(v => !v)}>💬 Discussion</button>}
            </div>
          )}

          {showChat && (
            <div style={{ marginTop: 10 }}>
              <BoxChat boxId={boxId} userId={userId} programBlockId={block.id} title="💬 Discussion sur ce bloc" height={280} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
