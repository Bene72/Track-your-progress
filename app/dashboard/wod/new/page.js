'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from '../../../../lib/hooks/useCurrentUser'
import { useBox } from '../../../../lib/hooks/useBox'
import { useWodData } from '../../../../lib/hooks/useWodData'
import { WOD_FORMATS, SCORING_TYPES, DEFAULT_SCORING, clockToSeconds } from '../../../../lib/constants'
import { wodSchema, sanitizeText } from '../../../../lib/security'

export default function NewWodPage() {
  const router = useRouter()
  const { userId } = useCurrentUser({ redirectIfNull: true })
  const box = useBox()
  const wodData = useWodData(box.activeBoxId, userId)

  const [title, setTitle] = useState('')
  const [format, setFormat] = useState('for_time')
  const [scoringType, setScoringType] = useState(DEFAULT_SCORING.for_time)
  const [description, setDescription] = useState('')
  const [wodDate, setWodDate] = useState(new Date().toISOString().slice(0, 10))
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
    }
    const parsed = wodSchema.safeParse(payload)
    if (!parsed.success) { setError('Vérifie les champs (titre et description obligatoires).'); return }
    setSaving(true)
    try {
      await wodData.createWod(payload)
      router.push(box.isCoach ? '/dashboard' : '/dashboard/wod')
    } catch (err) {
      setError(err.message)
    } finally { setSaving(false) }
  }

  return (
    <div className="stack">
      <div>
        <div className="eyebrow">{box.activeBoxName}</div>
        <h1 className="h1">{box.isCoach ? 'Publier le WOD' : 'Proposer un WOD'}</h1>
        {!box.isCoach && <p className="muted">Ta proposition sera visible par le coach pour validation avant de rejoindre le tableau du jour.</p>}
      </div>

      <form onSubmit={handleSubmit} className="stack card">
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
          <span style={{ fontSize: 14, color: 'var(--chalk)' }}>C'est un WOD benchmark (ex: Fran, Murph)</span>
        </label>

        {error && <div className="errorBox">{error}</div>}

        <button type="submit" className="btn btnPrimary btnBlock" disabled={saving}>
          {saving ? '...' : box.isCoach ? 'Publier le WOD' : 'Envoyer ma proposition'}
        </button>
      </form>
    </div>
  )
}
