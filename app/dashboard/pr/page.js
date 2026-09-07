'use client'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useCurrentUser } from '../../../lib/hooks/useCurrentUser'
import { usePrData } from '../../../lib/hooks/usePrData'
import { PR_VALUE_TYPES, formatSecondsToClock, clockToSeconds } from '../../../lib/constants'
import { prSchema, sanitizeText } from '../../../lib/security'

// Formatage manuel (DD/MM/YYYY), volontairement sans Intl/toLocaleDateString :
// le rendu serveur (Vercel) et le rendu client peuvent avoir des données ICU
// différentes pour la locale 'fr-FR', ce qui casse l'hydratation React
// (erreurs #418 / #423). Un format manuel est déterministe et identique
// des deux côtés.
function formatDateFr(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function formatPrValue(r) {
  if (r.value_type === 'time') return formatSecondsToClock(r.value_number)
  if (r.value_type === 'weight') return `${r.value_number} kg`
  return `${r.value_number} reps`
}

// Date du jour au format YYYY-MM-DD, en local (pas UTC), pour préremplir le
// champ <input type="date">. Évite aussi toute dépendance à toISOString()
// qui utilise UTC et peut décaler le jour selon le fuseau horaire.
function todayLocalKey() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function AddPrForm({ onSubmit, onDone }) {
  const [movement, setMovement] = useState('')
  const [valueType, setValueType] = useState('weight')
  const [rawValue, setRawValue] = useState('')
  const [achievedAt, setAchievedAt] = useState(() => todayLocalKey())
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
  return (
    <Suspense fallback={<div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>}>
      <PrPageContent />
    </Suspense>
  )
}

function PrPageContent() {
  const { userId } = useCurrentUser({ redirectIfNull: true })
  const pr = usePrData(userId)
  const [showForm, setShowForm] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  // Pré-filtre venant du menu "PRs" d'un mouvement (cf. ExerciseActionsMenu) :
  // /dashboard/pr?movement=Back%20Squat. Purement côté client, aucune requête
  // supplémentaire : on filtre les listes déjà chargées.
  const searchParams = useSearchParams()
  const movementFilter = searchParams.get('movement')
  const latestByMovement = movementFilter
    ? pr.latestByMovement.filter(r => r.movement.toLowerCase() === movementFilter.toLowerCase())
    : pr.latestByMovement
  const records = movementFilter
    ? pr.records.filter(r => r.movement.toLowerCase() === movementFilter.toLowerCase())
    : pr.records

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

      {latestByMovement.length === 0 ? (
        <div className="card empty">{movementFilter ? `Aucun PR pour "${movementFilter}" pour l'instant.` : 'Aucun PR enregistré. Ajoute ton premier record perso !'}</div>
      ) : (
        <div className="card">
          <h3 className="eyebrow" style={{ marginBottom: 8 }}>{movementFilter ? `Record actuel — ${movementFilter}` : 'Records actuels'}</h3>
          <div className="stack" style={{ gap: 0 }}>
            {latestByMovement.map(r => (
              <div key={r.movement} className="leaderRow">
                <span className="leaderName">{r.movement}</span>
                <span className="leaderScore mono">{formatPrValue(r)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {records.length > 0 && (
        <div className="card">
          <h3 className="eyebrow" style={{ marginBottom: 8 }}>Historique</h3>
          {deleteError && <div className="errorBox" style={{ marginBottom: 8 }}>{deleteError}</div>}
          <div className="stack" style={{ gap: 8 }}>
            {records.map(r => (
              <div key={r.id} className="row">
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{r.movement}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{formatDateFr(r.achieved_at)}</div>
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
