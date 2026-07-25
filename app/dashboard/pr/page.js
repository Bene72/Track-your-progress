'use client'
import { useState } from 'react'
import { useCurrentUser } from '../../../lib/hooks/useCurrentUser'
import { useBox } from '../../../lib/hooks/useBox'
import { usePrData } from '../../../lib/hooks/usePrData'
import { PR_VALUE_TYPES, formatSecondsToClock, clockToSeconds } from '../../../lib/constants'
import { prSchema, sanitizeText } from '../../../lib/security'

function formatPrValue(r) {
  if (r.value_type === 'time') return formatSecondsToClock(r.value_number)
  if (r.value_type === 'weight') return `${r.value_number} kg`
  return `${r.value_number} reps`
}

function AddPrForm({ onSubmit, onDone }) {
  const [movement, setMovement] = useState('')
  const [valueType, setValueType] = useState('weight')
  const [rawValue, setRawValue] = useState('')
  const [achievedAt, setAchievedAt] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    const value_number = valueType === 'time' ? clockToSeconds(rawValue) : Number(rawValue)
    const payload = {
      movement: sanitizeText(movement, 80),
      value_type: valueType,
      value_number,
      achieved_at: achievedAt,
      notes: sanitizeText(notes, 500),
    }
    const parsed = prSchema.safeParse(payload)
    if (!parsed.success) { setError('Vérifie le mouvement et la valeur.'); return }
    setSaving(true)
    try { await onSubmit(payload); onDone() } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="stack card">
      <div>
        <label>Mouvement</label>
        <input value={movement} onChange={e => setMovement(e.target.value)} placeholder="Ex: Back Squat, Fran, 5k Row" maxLength={80} required />
      </div>
      <div className="fieldGrid">
        <div>
          <label>Type</label>
          <select value={valueType} onChange={e => setValueType(e.target.value)}>
            {PR_VALUE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label>{valueType === 'time' ? 'Temps (mm:ss)' : valueType === 'weight' ? 'Charge (kg)' : 'Reps'}</label>
          <input value={rawValue} onChange={e => setRawValue(e.target.value)} placeholder={valueType === 'time' ? '3:45' : ''} required />
        </div>
      </div>
      <div>
        <label>Date</label>
        <input type="date" value={achievedAt} onChange={e => setAchievedAt(e.target.value)} required />
      </div>
      <div>
        <label>Notes (optionnel)</label>
        <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
      {error && <div className="errorBox">{error}</div>}
      <div className="row" style={{ gap: 10 }}>
        <button type="button" className="btn btnGhost" onClick={onDone}>Annuler</button>
        <button type="submit" className="btn btnPrimary btnBlock" disabled={saving}>{saving ? '...' : 'Enregistrer le PR'}</button>
      </div>
    </form>
  )
}

export default function PrPage() {
  const { userId } = useCurrentUser({ redirectIfNull: true })
  const box = useBox()
  const pr = usePrData(userId)
  const [showForm, setShowForm] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const handleDelete = async (id, movement) => {
    if (!confirm(`Supprimer le PR "${movement}" ? Cette action est irréversible.`)) return
    setDeleteError(null)
    try {
      await pr.deleteRecord(id)
    } catch (err) {
      setDeleteError(err.message || 'Erreur lors de la suppression')
    }
  }

  if (pr.loading) return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>

  return (
    <div className="stack">
      <div className="row">
        <h1 className="h1">Mes PR</h1>
        {!showForm && <button className="btn btnPrimary btnSm" onClick={() => setShowForm(true)}>+ PR</button>}
      </div>

      {showForm && <AddPrForm onSubmit={pr.addRecord} onDone={() => setShowForm(false)} />}

      {pr.latestByMovement.length === 0 ? (
        <div className="card empty">Aucun PR enregistré. Ajoute ton premier record perso !</div>
      ) : (
        <div className="card">
          <h3 className="eyebrow" style={{ marginBottom: 8 }}>Records actuels</h3>
          <div className="stack" style={{ gap: 0 }}>
            {pr.latestByMovement.map(r => (
              <div key={r.movement} className="leaderRow">
                <span className="leaderName">{r.movement}</span>
                <span className="leaderScore mono">{formatPrValue(r)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {pr.records.length > 0 && (
        <div className="card">
          <h3 className="eyebrow" style={{ marginBottom: 8 }}>Historique</h3>
          {deleteError && <div className="errorBox" style={{ marginBottom: 8 }}>{deleteError}</div>}
          <div className="stack" style={{ gap: 8 }}>
            {pr.records.map(r => (
              <div key={r.id} className="row">
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{r.movement}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{new Date(r.achieved_at + 'T00:00:00').toLocaleDateString('fr-FR')}</div>
                </div>
                <div className="row" style={{ gap: 10, width: 'auto' }}>
                  <span className="mono" style={{ fontWeight: 700 }}>{formatPrValue(r)}</span>
                  <button className="btn btnGhost btnSm" onClick={() => handleDelete(r.id, r.movement)} aria-label="Supprimer">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
