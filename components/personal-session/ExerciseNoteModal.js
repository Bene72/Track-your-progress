'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

// Note persistante par (utilisateur, mouvement) : suit le mouvement partout
// où il apparaît (pas juste dans cette séance). Stockée dans
// personal_exercise_notes (cf. supabase_migration_v3.sql).
export default function ExerciseNoteModal({ exercise, userId, onClose }) {
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error: fetchError } = await supabase
        .from('personal_exercise_notes')
        .select('note')
        .eq('user_id', userId)
        .eq('exercise_id', exercise.id)
        .maybeSingle()
      if (cancelled) return
      if (fetchError) setError(fetchError.message)
      else setNote(data?.note || '')
      setLoading(false)
    }
    if (exercise?.id && userId) load()
    return () => { cancelled = true }
  }, [exercise?.id, userId])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const trimmed = note.trim()
      if (!trimmed) {
        await supabase.from('personal_exercise_notes').delete().eq('user_id', userId).eq('exercise_id', exercise.id)
      } else {
        const { error: upsertError } = await supabase
          .from('personal_exercise_notes')
          .upsert({ user_id: userId, exercise_id: exercise.id, note: trimmed, updated_at: new Date().toISOString() })
        if (upsertError) throw upsertError
      }
      onClose(trimmed)
    } catch (err) {
      setError(err.message || 'Impossible d\'enregistrer la note.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="note-overlay" role="dialog" aria-modal="true" onClick={() => onClose(null)}>
      <style jsx>{`
        .note-overlay { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 16px; background: rgba(0,0,0,.6); }
        .note-modal { width: 100%; max-width: 380px; border: 1px solid rgba(255,255,255,.12); border-radius: 18px; background: #17140F; padding: 18px; }
        .note-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .note-title { font-size: 15px; font-weight: 850; }
        .note-close { border: 0; background: transparent; color: rgba(255,255,255,.5); font-size: 16px; cursor: pointer; }
        .note-hint { color: rgba(255,255,255,.45); font-size: 11px; margin-bottom: 10px; }
        .note-textarea { width: 100%; box-sizing: border-box; min-height: 90px; padding: 10px; border: 1px solid rgba(255,255,255,.1); border-radius: 12px; color: white; background: rgba(255,255,255,.04); font: inherit; font-size: 13px; outline: none; resize: vertical; }
        .note-textarea:focus { border-color: rgba(249,115,22,.6); }
        .note-actions { display: flex; gap: 8px; margin-top: 12px; }
        .note-btn { flex: 1; min-height: 38px; border-radius: 10px; font: inherit; font-size: 12.5px; font-weight: 800; cursor: pointer; border: 1px solid transparent; }
        .note-cancel { color: rgba(255,255,255,.6); background: transparent; border-color: rgba(255,255,255,.12) !important; }
        .note-save { color: white; background: linear-gradient(135deg, #F97316, #C2410C); }
        .note-save:disabled { opacity: .5; cursor: default; }
        .note-error { margin-top: 8px; color: #ff9d9d; font-size: 12px; }
      `}</style>
      <div className="note-modal" onClick={e => e.stopPropagation()}>
        <div className="note-head">
          <div className="note-title">📝 Note — {exercise?.name}</div>
          <button className="note-close" onClick={() => onClose(null)} aria-label="Fermer">✕</button>
        </div>
        <p className="note-hint">Cette note te suivra sur ce mouvement dans toutes tes futures séances (cue technique, rappel de mobilité, etc.)</p>
        {loading ? (
          <p className="note-hint">Chargement…</p>
        ) : (
          <textarea
            className="note-textarea"
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={1000}
            placeholder="Ex. Pause 2s en bas, coudes serrés"
          />
        )}
        {error && <div className="note-error">{error}</div>}
        <div className="note-actions">
          <button type="button" className="note-btn note-cancel" onClick={() => onClose(null)}>Annuler</button>
          <button type="button" className="note-btn note-save" onClick={handleSave} disabled={saving || loading}>
            {saving ? '...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
