'use client'

import { useState } from 'react'
import { clockToSeconds, formatSecondsToClock } from '../lib/constants'
import { sanitizeText, scoreSchema } from '../lib/security'

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

  async function handleSubmit(event) {
    event.preventDefault(); setError(null)
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
    try { await onSubmit(parsed.data) }
    catch { setError('Impossible d’enregistrer le score. Réessaie.') }
    finally { setSaving(false) }
  }

  return <form onSubmit={handleSubmit} className="stack">
    <div className="segmented" aria-label="Type de score"><button type="button" aria-pressed={rx} className={`segmentedBtn ${rx ? 'segmentedBtnActive' : ''}`} onClick={() => setRx(true)}>RX</button><button type="button" aria-pressed={!rx} className={`segmentedBtn ${!rx ? 'segmentedBtnActive' : ''}`} onClick={() => setRx(false)}>Scaled</button></div>
    {wod.scoring_type === 'time' && <div><label htmlFor="score-clock">Temps (mm:ss)</label><input id="score-clock" value={clock} onChange={(e) => setClock(e.target.value)} placeholder="12:34" inputMode="numeric" pattern="[0-9]{1,3}:[0-5][0-9]" required /></div>}
    {wod.scoring_type === 'rounds_reps' && <div className="fieldGrid"><div><label htmlFor="rounds">Rounds complets</label><input id="rounds" type="number" min="0" max="999" value={rounds} onChange={(e) => setRounds(e.target.value)} required /></div><div><label htmlFor="extra-reps">+ Reps</label><input id="extra-reps" type="number" min="0" max="9999" value={extraReps} onChange={(e) => setExtraReps(e.target.value)} /></div></div>}
    {wod.scoring_type === 'load' && <div><label htmlFor="load">Charge (kg)</label><input id="load" type="number" step="0.01" min="0" max="999" value={load} onChange={(e) => setLoad(e.target.value)} required /></div>}
    {wod.scoring_type === 'reps' && <div><label htmlFor="reps">Reps totales</label><input id="reps" type="number" min="0" max="99999" value={reps} onChange={(e) => setReps(e.target.value)} required /></div>}
    <div><label htmlFor="notes">Notes (optionnel)</label><textarea id="notes" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
    {error && <div className="errorBox" role="alert">{error}</div>}
    <div className="row" style={{ gap: 10 }}>{onCancel && <button type="button" className="btn btnGhost" onClick={onCancel} disabled={saving}>Annuler</button>}<button type="submit" className="btn btnPrimary btnBlock" disabled={saving}>{saving ? '…' : existingScore ? 'Mettre à jour mon score' : 'Valider mon score'}</button></div>
  </form>
}
