'use client'

import { useState } from 'react'
import { WOD_FORMATS, SCORING_TYPES, DEFAULT_SCORING, clockToSeconds } from '../lib/constants'
import { sanitizeText, wodSchema } from '../lib/security'
import { localDateKey } from '../lib/date'
import VideoUploadField from './VideoUploadField'

export default function WodCreateForm({ isCoach, userId, onSubmit, onCancel }) {
  const [title, setTitle] = useState(''); const [format, setFormat] = useState('for_time'); const [scoringType, setScoringType] = useState(DEFAULT_SCORING.for_time)
  const [description, setDescription] = useState(''); const [wodDate, setWodDate] = useState(localDateKey()); const [timeCap, setTimeCap] = useState(''); const [emomInterval, setEmomInterval] = useState('60'); const [emomRounds, setEmomRounds] = useState(''); const [isBenchmark, setIsBenchmark] = useState(false); const [videoUrl, setVideoUrl] = useState(''); const [saving, setSaving] = useState(false); const [error, setError] = useState(null)
  function changeFormat(nextFormat) { setFormat(nextFormat); setScoringType(DEFAULT_SCORING[nextFormat]) }
  async function handleSubmit(event) {
    event.preventDefault(); setError(null)
    // `status`, `box_id` et `created_by` ne doivent jamais venir du client.
    const parsed = wodSchema.safeParse({ title: sanitizeText(title, 120), format, scoring_type: scoringType, description: sanitizeText(description, 3000), wod_date: wodDate, time_cap_sec: timeCap ? clockToSeconds(timeCap) : null, emom_interval_sec: format === 'emom' && emomInterval ? Number(emomInterval) : null, emom_rounds: format === 'emom' && emomRounds ? Number(emomRounds) : null, is_benchmark: isBenchmark, video_url: videoUrl ? sanitizeText(videoUrl, 500) : null })
    if (!parsed.success) { setError('Vérifie les champs et les limites de valeurs.'); return }
    setSaving(true); try { await onSubmit(parsed.data) } catch { setError('Impossible de créer le WOD. Réessaie.') } finally { setSaving(false) }
  }
  return <form onSubmit={handleSubmit} className="stack">
    <div><label htmlFor="wod-title">Titre</label><input id="wod-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required /></div>
    <div><label htmlFor="wod-date">Date</label><input id="wod-date" type="date" value={wodDate} onChange={(e) => setWodDate(e.target.value)} required /></div>
    <div><label htmlFor="wod-format">Format</label><select id="wod-format" value={format} onChange={(e) => changeFormat(e.target.value)}>{WOD_FORMATS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
    {format === 'emom' && <div className="fieldGrid"><div><label htmlFor="emom-interval">Intervalle (sec)</label><input id="emom-interval" type="number" min="1" max="3600" value={emomInterval} onChange={(e) => setEmomInterval(e.target.value)} required /></div><div><label htmlFor="emom-rounds">Nb rounds</label><input id="emom-rounds" type="number" min="1" max="200" value={emomRounds} onChange={(e) => setEmomRounds(e.target.value)} required /></div></div>}
    {(format === 'for_time' || format === 'amrap') && <div><label htmlFor="time-cap">Time cap (mm:ss, optionnel)</label><input id="time-cap" value={timeCap} onChange={(e) => setTimeCap(e.target.value)} placeholder="20:00" inputMode="numeric" pattern="[0-9]{1,3}:[0-5][0-9]" /></div>}
    <div><label htmlFor="wod-description">Description du WOD</label><textarea id="wod-description" rows={6} value={description} onChange={(e) => setDescription(e.target.value)} required maxLength={3000} /></div>
    <div><label htmlFor="wod-video">Lien vidéo (démo technique, optionnel)</label><input id="wod-video" type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://..." maxLength={500} /><VideoUploadField userId={userId} folder="wod-videos" onUploaded={setVideoUrl} /></div>
    <div><label htmlFor="scoring-type">Type de score attendu</label><select id="scoring-type" value={scoringType} onChange={(e) => setScoringType(e.target.value)}>{SCORING_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', cursor: 'pointer' }}><input type="checkbox" style={{ width: 'auto' }} checked={isBenchmark} onChange={(e) => setIsBenchmark(e.target.checked)} /><span style={{ fontSize: 14, color: 'var(--chalk)' }}>C’est un WOD benchmark</span></label>
    {!isCoach && <p className="muted" style={{ fontSize: 13 }}>Ta proposition sera visible par le coach pour validation.</p>}{error && <div className="errorBox" role="alert">{error}</div>}
    <div className="row" style={{ gap: 8 }}><button type="button" className="btn btnGhost" onClick={onCancel} disabled={saving}>Annuler</button><button type="submit" className="btn btnPrimary" style={{ flex: 1 }} disabled={saving}>{saving ? '…' : isCoach ? 'Publier le WOD' : 'Envoyer ma proposition'}</button></div>
  </form>
}
