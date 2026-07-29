'use client'
import { useState } from 'react'
import { WOD_FORMATS, SCORING_TYPES, DEFAULT_SCORING, clockToSeconds } from '../lib/constants'
import { wodSchema, sanitizeText } from '../lib/security'
import { localDateKey } from '../lib/date'

// Formulaire de création de WOD, avec date éditable (pour rattraper un jour
// oublié). Utilisé depuis l'onglet "Aujourd'hui" — remplace l'ancienne page
// dédiée /dashboard/wod/new.
export default function WodCreateForm({ isCoach, onSubmit, onCancel }) {
  const [title, setTitle] = useState('')
  const [format, setFormat] = useState('for_time')
  const [scoringType, setScoringType] = useState(DEFAULT_SCORING.for_time)
  const [description, setDescription] = useState('')
  const [wodDate, setWodDate] = useState(localDateKey())
  const [timeCap, setTimeCap] = useState('')
  const [emomInterval, setEmomInterval] = useState('60')
  const [emomRounds, setEmomRounds] = useState('')
  const [isBenchmark, setIsBenchmark] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleFormatChange = (f) => {
    setFormat(f)
    setScoringType(DEFAULT_SCORING[f])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    const payload = {
      title: sanitizeText(title, 120),
      format,
      scoring_type: scoringType,
      description: sanitizeText(description, 3000),
      wod_date: wodDate,
      time_cap_sec: timeCap ? clockToSeconds(timeCap) : null,
      emom_interval_sec: format === 'emom' && emomInterval ? Number(emomInterval) : null,
      emom_rounds: format === 'emom' && emomRounds ? Number(emomRounds) : null,
      is_benchmark: isBenchmark,
      status: isCoach ? 'published' : 'pending',
    }
    const parsed = wodSchema.safeParse(payload)
    if (!parsed.success) { setError('Vérifie les champs (titre et description obligatoires).'); return }
    setSaving(true)
    try {
      await onSubmit(payload)
    } catch (err) {
      setError(err.message)
    } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="stack">
      <div>
        <label>Titre</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Fran, ou 'WOD du 24/07'" maxLength={120} required />
      </div>

      <div>
        <label>Date</label>
        <input type="date" value={wodDate} onChange={e => setWodDate(e.target.value)} required />
      </div>

      <div>
        <label>Format</label>
        <select value={format} onChange={e => handleFormatChange(e.target.value)}>
          {WOD_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      {format === 'emom' && (
        <div className="fieldGrid">
          <div><label>Intervalle (sec)</label><input type="number" value={emomInterval} onChange={e => setEmomInterval(e.target.value)} /></div>
          <div><label>Nb rounds</label><input type="number" value={emomRounds} onChange={e => setEmomRounds(e.target.value)} /></div>
        </div>
      )}

      {(format === 'for_time' || format === 'amrap') && (
        <div>
          <label>Time cap (mm:ss, optionnel)</label>
          <input value={timeCap} onChange={e => setTimeCap(e.target.value)} placeholder="20:00" />
        </div>
      )}

      <div>
        <label>Description du WOD</label>
        <textarea rows={6} value={description} onChange={e => setDescription(e.target.value)}
          placeholder={'Ex:\n21-15-9\nThrusters (42.5/30kg)\nPull-ups'} required maxLength={3000} />
      </div>

      <div>
        <label>Type de score attendu</label>
        <select value={scoringType} onChange={e => setScoringType(e.target.value)}>
          {SCORING_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', cursor: 'pointer' }}>
        <input type="checkbox" style={{ width: 'auto' }} checked={isBenchmark} onChange={e => setIsBenchmark(e.target.checked)} />
        <span style={{ fontSize: 14, color: 'var(--chalk)' }}>C&apos;est un WOD benchmark (ex: Fran, Murph)</span>
      </label>

      {!isCoach && <p className="muted" style={{ fontSize: 13 }}>Ta proposition sera visible par le coach pour validation.</p>}

      {error && <div className="errorBox">{error}</div>}

      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="btn btnGhost" onClick={onCancel} disabled={saving}>Annuler</button>
        <button type="submit" className="btn btnPrimary" style={{ flex: 1 }} disabled={saving}>
          {saving ? '...' : isCoach ? 'Publier le WOD' : 'Envoyer ma proposition'}
        </button>
      </div>
    </form>
  )
}
