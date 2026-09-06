'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from '../../../lib/hooks/useCurrentUser'
import { useBox } from '../../../lib/hooks/useBox'
import { useProgramsList } from '../../../lib/hooks/usePrograms'
import { localDateKey } from '../../../lib/date'
import CoachDashboardCard from '../../../components/program/CoachDashboardCard'

const STATUS_LABELS = { draft: 'Brouillon', active: 'Actif', completed: 'Terminé', archived: 'Archivé' }

function NewProgramForm({ athleteId, onCreate, onCancel }) {
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState(localDateKey())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Nom requis.'); return }
    setSaving(true)
    setError(null)
    try {
      await onCreate({ athleteId, name: name.trim(), startDate })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <label className="label">Nom du programme</label>
      <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder='Ex. "Cycle force — 6 semaines"' autoFocus />
      <label className="label" style={{ marginTop: 8 }}>Date de début (semaine 1, lundi)</label>
      <input className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
      {error && <div className="errorBox" style={{ marginTop: 8 }}>{error}</div>}
      <div className="row" style={{ marginTop: 10, gap: 8 }}>
        <button className="action" onClick={onCancel}>Annuler</button>
        <button className="action primary" onClick={handleSubmit} disabled={saving}>{saving ? '...' : 'Créer'}</button>
      </div>
    </div>
  )
}

export default function ProgrammePage() {
  const { userId } = useCurrentUser({ redirectIfNull: true })
  const box = useBox()
  const { myPrograms, athletes, loading, error, createProgram } = useProgramsList({
    userId, boxId: box.activeBoxId, isCoach: box.isCoach,
  })
  const [creatingForSelf, setCreatingForSelf] = useState(false)
  const [creatingForAthlete, setCreatingForAthlete] = useState(null)
  const router = useRouter()

  const handleCreate = async (payload) => {
    const program = await createProgram(payload)
    setCreatingForSelf(false)
    setCreatingForAthlete(null)
    router.push(`/dashboard/programme/${program.id}`)
  }

  if (loading || box.loading) return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>

  return (
    <div className="stack">
      <div className="row">
        <h1 className="h1">Programme</h1>
      </div>
      {error && <div className="errorBox">{error}</div>}

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 className="h2">Mes programmes</h2>
        <button className="action primary" onClick={() => setCreatingForSelf(v => !v)}>Programmer</button>
      </div>
      {creatingForSelf && (
        <NewProgramForm athleteId={userId} onCreate={handleCreate} onCancel={() => setCreatingForSelf(false)} />
      )}

      {myPrograms.length === 0 ? (
        <div className="card empty">Aucun programme pour l&apos;instant. Ton coach peut t&apos;en assigner un, ou tu peux en construire un toi-même.</div>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          {myPrograms.map(p => (
            <Link key={p.id} href={`/dashboard/programme/${p.id}`} className="card" style={{ display: 'block', textDecoration: 'none' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong style={{ color: 'white' }}>{p.name}</strong>
                <span className="badge">{STATUS_LABELS[p.status]}</span>
              </div>
              <p className="muted" style={{ marginTop: 4 }}>Débute le {new Date(`${p.start_date}T00:00:00`).toLocaleDateString('fr-FR')}</p>
            </Link>
          ))}
        </div>
      )}

      {box.isCoach && (
        <>
          <CoachDashboardCard boxId={box.activeBoxId} isCoach={box.isCoach} />

          <h2 className="h2" style={{ marginTop: 16 }}>Mon effectif</h2>
          <div className="stack" style={{ gap: 8 }}>
            {athletes.filter(a => a.role === 'member').map(a => (
              <div key={a.userId} className="card">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong style={{ color: 'white' }}>{a.name}</strong>
                  <button className="action" onClick={() => setCreatingForAthlete(v => (v === a.userId ? null : a.userId))}>
                    Programmer
                  </button>
                </div>
                {creatingForAthlete === a.userId && (
                  <NewProgramForm athleteId={a.userId} onCreate={handleCreate} onCancel={() => setCreatingForAthlete(null)} />
                )}
              </div>
            ))}
            {athletes.filter(a => a.role === 'member').length === 0 && (
              <div className="card empty">Aucun membre dans ta box pour l&apos;instant.</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
