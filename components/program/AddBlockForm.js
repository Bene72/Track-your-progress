'use client'
import { useState } from 'react'
import ExerciseAutocomplete from '../personal-session/ExerciseAutocomplete'
import { BLOCK_TYPES } from '../../lib/blockTypes'

export default function AddBlockForm({ catalog, onAddBlock, onCreateExercise }) {
  const [open, setOpen] = useState(false)
  const [blockType, setBlockType] = useState('exercise')
  const [title, setTitle] = useState('')
  const [prescription, setPrescription] = useState('')
  const [notes, setNotes] = useState('')
  const [exerciseId, setExerciseId] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [percent1rm, setPercent1rm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const reset = () => {
    setBlockType('exercise'); setTitle(''); setPrescription(''); setNotes(''); setExerciseId(''); setVideoUrl(''); setPercent1rm(''); setOpen(false)
  }

  const handleSubmit = async () => {
    if (!title.trim()) { setError('Titre requis.'); return }
    setSaving(true)
    setError(null)
    try {
      await onAddBlock({
        blockType,
        title: title.trim(),
        prescription: prescription.trim(),
        notes: notes.trim(),
        exerciseId: exerciseId || null,
        videoUrl: videoUrl.trim() || null,
        percent1rm: percent1rm === '' ? null : Number(percent1rm),
      })
      reset()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button type="button" className="abf-open" onClick={() => setOpen(true)}>
        <style jsx>{`
          .abf-open { width: 100%; min-height: 36px; margin-top: 4px; border: 1px dashed rgba(255,255,255,.15); border-radius: 10px; color: rgba(255,255,255,.55); background: transparent; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
          .abf-open:hover { color: #FDBA74; border-color: rgba(249,115,22,.4); }
        `}</style>
        ＋ Ajouter
      </button>
    )
  }

  return (
    <div className="abf">
      <style jsx>{`
        .abf { border: 1px solid rgba(249,115,22,.25); border-radius: 12px; padding: 12px; margin-top: 4px; background: rgba(249,115,22,.04); }
        .abf-field { width: 100%; box-sizing: border-box; margin-bottom: 8px; padding: 8px 10px; border: 1px solid rgba(255,255,255,.1); border-radius: 10px; color: white; background: rgba(255,255,255,.04); font: inherit; font-size: 12.5px; outline: none; }
        .abf-actions { display: flex; gap: 8px; margin-top: 4px; }
        .abf-btn { flex: 1; min-height: 34px; border-radius: 9px; font: inherit; font-size: 12px; font-weight: 800; cursor: pointer; border: 1px solid transparent; }
        .abf-cancel { color: rgba(255,255,255,.6); background: transparent; border-color: rgba(255,255,255,.12) !important; }
        .abf-save { color: white; background: linear-gradient(135deg, #F97316, #C2410C); }
        .abf-save:disabled { opacity: .5; cursor: default; }
        .abf-error { color: #ff9d9d; font-size: 11px; margin-bottom: 6px; }
        .abf-label { display: block; margin-bottom: 4px; color: rgba(255,255,255,.45); font-size: 10px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; }
        .abf-types { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
        .abf-type { display: inline-flex; align-items: center; gap: 5px; padding: 6px 10px; border-radius: 999px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.04); color: rgba(255,255,255,.6); font: inherit; font-size: 11.5px; font-weight: 700; cursor: pointer; }
        .abf-type.active { color: #16110D; border-color: transparent; }
      `}</style>

      <label className="abf-label">Type de bloc</label>
      <div className="abf-types">
        {BLOCK_TYPES.map(t => (
          <button
            key={t.value}
            type="button"
            className={`abf-type ${blockType === t.value ? 'active' : ''}`}
            style={blockType === t.value ? { background: t.color } : undefined}
            onClick={() => setBlockType(t.value)}
          >
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      <label className="abf-label">Titre</label>
      <input className="abf-field" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex. Pause back squat" autoFocus />

      <label className="abf-label">Mouvement lié (optionnel — débloque vidéo/historique/PR)</label>
      <ExerciseAutocomplete catalog={catalog} value={exerciseId} onChange={setExerciseId} onCreateNew={onCreateExercise} placeholder="Rechercher un mouvement…" />

      <label className="abf-label" style={{ marginTop: 8 }}>Prescription</label>
      <textarea className="abf-field" rows={2} value={prescription} onChange={e => setPrescription(e.target.value)} placeholder="Ex. 5x5 - tempo 32X1" />

      {exerciseId && (
        <>
          <label className="abf-label">% du 1RM (optionnel — calcule la charge auto pour l&apos;athlète)</label>
          <input className="abf-field" type="number" min="1" max="200" value={percent1rm} onChange={e => setPercent1rm(e.target.value)} placeholder="Ex. 75" />
        </>
      )}

      <label className="abf-label">Note pour l&apos;athlète</label>
      <textarea className="abf-field" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Consignes, focus technique..." />

      {!exerciseId && (
        <>
          <label className="abf-label">Lien vidéo (si pas de mouvement du catalogue)</label>
          <input className="abf-field" type="url" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://..." />
        </>
      )}

      {error && <div className="abf-error">{error}</div>}
      <div className="abf-actions">
        <button type="button" className="abf-btn abf-cancel" onClick={reset}>Annuler</button>
        <button type="button" className="abf-btn abf-save" onClick={handleSubmit} disabled={saving}>{saving ? '...' : 'Ajouter'}</button>
      </div>
    </div>
  )
}
