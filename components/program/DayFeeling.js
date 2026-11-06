'use client'
import { useState, useEffect } from 'react'

// "Ressenti du jour" : l'athlète note sa séance de 1 à 5 et peut laisser un mot ;
// le coach le lit sur la même page (lecture seule). Un tap sur une note
// l'enregistre tout de suite ; le mot s'enregistre en quittant le champ.
export const FEELING_FACES = [
  { rating: 1, face: '😫', label: 'Très dur' },
  { rating: 2, face: '😕', label: 'Dur' },
  { rating: 3, face: '😐', label: 'Correct' },
  { rating: 4, face: '🙂', label: 'Bien' },
  { rating: 5, face: '🔥', label: 'Excellent' },
]

export function feelingFace(rating) {
  return FEELING_FACES.find(f => f.rating === rating)
}

export default function DayFeeling({ feeling, canWrite, athleteName, onSave }) {
  const [rating, setRating] = useState(feeling?.rating || 0)
  const [comment, setComment] = useState(feeling?.comment || '')
  const [status, setStatus] = useState('idle') // idle | saving | saved | error
  const [error, setError] = useState(null)

  // Quand on change de jour, repartir du ressenti de CE jour.
  useEffect(() => {
    setRating(feeling?.rating || 0)
    setComment(feeling?.comment || '')
    setStatus('idle')
    setError(null)
  }, [feeling?.feeling_date, feeling?.rating, feeling?.comment])

  const save = async (nextRating, nextComment) => {
    if (!nextRating) return
    setStatus('saving')
    setError(null)
    try {
      await onSave(nextRating, nextComment)
      setStatus('saved')
    } catch (err) {
      setStatus('error')
      setError(err.message)
    }
  }

  // Lecture seule (coach, ou jour à venir pour l'athlète)
  if (!canWrite) {
    const face = feelingFace(feeling?.rating)
    return (
      <div className="card" style={{ padding: 14 }}>
        <div className="eyebrow" style={{ color: 'var(--chalk-muted)', marginBottom: 6 }}>Ressenti{athleteName ? ` de ${athleteName}` : ''}</div>
        {face ? (
          <>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{face.face} {face.label} <span className="muted">({face.rating}/5)</span></div>
            {feeling.comment && <p className="muted" style={{ marginTop: 4, fontStyle: 'italic' }}>« {feeling.comment} »</p>}
          </>
        ) : (
          <p className="muted">Pas encore de ressenti pour ce jour.</p>
        )}
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>Comment s’est passée ta séance ?</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
        {FEELING_FACES.map(f => {
          const on = rating === f.rating
          return (
            <button
              key={f.rating}
              type="button"
              aria-pressed={on}
              onClick={() => { setRating(f.rating); save(f.rating, comment) }}
              style={{
                padding: '8px 2px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                border: `1px solid ${on ? 'var(--accent)' : 'var(--border-hi)'}`,
                background: on ? 'var(--accent-dim)' : 'var(--bg-card-2)', color: 'var(--chalk)',
              }}
            >
              <div style={{ fontSize: 22, lineHeight: 1.1 }}>{f.face}</div>
              <div style={{ fontSize: 10, marginTop: 2, color: on ? 'var(--accent)' : 'var(--chalk-muted)', fontWeight: 600 }}>{f.label}</div>
            </button>
          )
        })}
      </div>
      <input
        className="input"
        style={{ marginTop: 10 }}
        value={comment}
        maxLength={280}
        onChange={e => setComment(e.target.value)}
        onBlur={() => { if (rating && comment !== (feeling?.comment || '')) save(rating, comment) }}
        placeholder={rating ? 'Un mot pour ton coach (optionnel)' : 'Choisis une note pour ajouter un mot'}
        disabled={!rating}
      />
      <div style={{ minHeight: 18, marginTop: 6, fontSize: 12 }} aria-live="polite">
        {status === 'saving' && <span className="muted">Enregistrement…</span>}
        {status === 'saved' && <span style={{ color: 'var(--rx)' }}>✓ Enregistré</span>}
        {status === 'error' && <span style={{ color: 'var(--danger)' }}>{error}</span>}
      </div>
    </div>
  )
}
