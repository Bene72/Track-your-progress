'use client'
import { useState } from 'react'
import { clockToSeconds, formatSecondsToClock } from '../lib/constants'
import { scoreSchema, sanitizeText } from '../lib/security'

export default function ScoreForm({ wod, existingScore, onSubmit, onCancel }) {
  const [rx, setRx] = useState(existingScore?.rx ?? true)
  const [clock, setClock] = useState(existingScore?.time_seconds != null ? formatSecondsToClock(existingScore.time_seconds) : '')
  const [rounds, setRounds] = useState(existingScore?.rounds ?? '')
  const [extraReps, setExtraReps] = useState(existingScore?.extra_reps ?? '')
  const [load, setLoad] = useState(existingScore?.load_kg ?? '')
  const [reps, setReps] = useState(existingScore?.reps ?? '')
  const [notes, setNotes] = useState(existingScore?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    const payload = {
      rx,
      time_seconds: wod.scoring_type === 'time' ? clockToSeconds(clock) : null,
      rounds: wod.scoring_type === 'rounds_reps' ? (rounds === '' ? null : Number(rounds)) : null,
      extra_reps: wod.scoring_type === 'rounds_reps' ? (extraReps === '' ? 0 : Number(extraReps)) : null,
      load_kg: wod.scoring_type === 'load' ? (load === '' ? null : Number(load)) : null,
      reps: wod.scoring_type === 'reps' ? (reps === '' ? null : Number(reps)) : null,
      notes: sanitizeText(notes, 500),
    }
    const parsed = scoreSchema.safeParse(payload)
    if (!parsed.success) { setError('Vérifie les valeurs saisies.'); return }
    setSaving(true)
    try {
      await onSubmit(payload)
    } catch (err) {
      setError(err.message)
    } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="stack">
      <div className="segmented">
        <button type="button" className={`segmentedBtn ${rx ? 'segmentedBtnActive' : ''}`} onClick={() => setRx(true)}>RX</button>
        <button type="button" className={`segmentedBtn ${!rx ? 'segmentedBtnActive' : ''}`} onClick={() => setRx(false)}>Scaled</button>
      </div>

      {wod.scoring_type === 'time' && (
        <div>
          <label>Temps (mm:ss)</label>
          <input value={clock} onChange={e => setClock(e.target.value)} placeholder="12:34" required />
        </div>
      )}

      {wod.scoring_type === 'rounds_reps' && (
        <div className="fieldGrid">
          <div><label>Rounds complets</label><input type="number" min="0" value={rounds} onChange={e => setRounds(e.target.value)} required /></div>
          <div><label>+ Reps</label><input type="number" min="0" value={extraReps} onChange={e => setExtraReps(e.target.value)} /></div>
        </div>
      )}

      {wod.scoring_type === 'load' && (
        <div>
          <label>Charge (kg)</label>
          <input type="number" step="0.5" min="0" value={load} onChange={e => setLoad(e.target.value)} required />
        </div>
      )}

      {wod.scoring_type === 'reps' && (
        <div>
          <label>Reps totales</label>
          <input type="number" min="0" value={reps} onChange={e => setReps(e.target.value)} required />
        </div>
      )}

      <div>
        <label>Notes (optionnel)</label>
        <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Sensations, charges utilisées..." />
      </div>

      {error && <div className="errorBox">{error}</div>}

      <div className="row" style={{ gap: 10 }}>
        {onCancel && <button type="button" className="btn btnGhost" onClick={onCancel}>Annuler</button>}
        <button type="submit" className="btn btnPrimary btnBlock" disabled={saving}>
          {saving ? '...' : existingScore ? 'Mettre à jour mon score' : 'Valider mon score'}
        </button>
      </div>
    </form>
  )
}
