'use client'
import { useState } from 'react'
import { localDateKey } from '../../lib/date'

export default function DuplicateToAthleteForm({ athletes, defaultName, onDuplicate, onCancel }) {
  const [athleteId, setAthleteId] = useState(athletes[0]?.userId || '')
  const [name, setName] = useState(`${defaultName} (copie)`)
  const [startDate, setStartDate] = useState(localDateKey())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async () => {
    if (!athleteId) { setError('Choisis un athlète.'); return }
    setSaving(true)
    setError(null)
    try {
      await onDuplicate({ athleteId, startDate, name: name.trim() || defaultName })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (athletes.length === 0) {
    return <div className="card empty" style={{ marginTop: 8 }}>Aucun autre membre dans la box vers qui dupliquer.</div>
  }

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <label className="label">Athlète cible</label>
      <select className="input" value={athleteId} onChange={e => setAthleteId(e.target.value)}>
        {athletes.map(a => <option key={a.userId} value={a.userId}>{a.name}</option>)}
      </select>
      <label className="label" style={{ marginTop: 8 }}>Nom du nouveau programme</label>
      <input className="input" value={name} onChange={e => setName(e.target.value)} />
      <label className="label" style={{ marginTop: 8 }}>Date de début (semaine 1, lundi)</label>
      <input className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
      {error && <div className="errorBox" style={{ marginTop: 8 }}>{error}</div>}
      <div className="row" style={{ marginTop: 10, gap: 8 }}>
        <button className="action" onClick={onCancel}>Annuler</button>
        <button className="action primary" onClick={handleSubmit} disabled={saving}>{saving ? '...' : 'Dupliquer'}</button>
      </div>
      <p className="muted" style={{ marginTop: 8, fontSize: 11 }}>
        La structure complète (semaines, séances, blocs) est copiée en brouillon — relis-la avant de la publier.
      </p>
    </div>
  )
}
