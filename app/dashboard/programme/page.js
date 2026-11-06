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

// Création d'un programme. Pour un coach, deux choix :
//  - "Toute la box" : un seul programme partagé, consulté en lecture seule par
//    tous les membres une fois publié ;
//  - "Individuel" : programme attribué à un athlète (soi-même ou un membre).
function NewProgramForm({ athleteId, canChooseScope = false, athletes = [], onCreate, onCancel }) {
  const [scope, setScope] = useState(canChooseScope ? 'box' : 'individual')
  const [targetId, setTargetId] = useState(athleteId)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState(localDateKey())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Nom requis.'); return }
    setSaving(true)
    setError(null)
    try {
      await onCreate({ athleteId: targetId, shared: scope === 'box', name: name.trim(), startDate })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card" style={{ marginTop: 8 }}>
      {canChooseScope && (
        <>
          <label className="label">Pour qui ?</label>
          <div className="action-row">
            <button type="button" className={`action ${scope === 'box' ? 'primary' : ''}`} onClick={() => setScope('box')}>🏟 Toute la box</button>
            <button type="button" className={`action ${scope === 'individual' ? 'primary' : ''}`} onClick={() => setScope('individual')}>👤 Individuel</button>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            {scope === 'box'
              ? 'Un seul programme, visible en lecture seule par tous les membres une fois publié.'
              : 'Programme attribué à un seul athlète.'}
          </p>
          {scope === 'individual' && (
            <>
              <label className="label" style={{ marginTop: 8 }}>Athlète</label>
              <select className="input" value={targetId} onChange={e => setTargetId(e.target.value)}>
                <option value={athleteId}>Moi</option>
                {athletes.map(a => <option key={a.userId} value={a.userId}>{a.name}</option>)}
              </select>
            </>
          )}
        </>
      )}
      <label className="label" style={{ marginTop: canChooseScope ? 8 : 0 }}>Nom du programme</label>
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

const DANGER_STYLE = { color: 'var(--danger)', borderColor: 'rgba(255,74,74,0.35)' }

// Une ligne de programme : lien vers le détail + boutons Renommer / Supprimer
// (affichés seulement si l'utilisateur peut gérer ce programme — coach ou
// créateur, comme la RLS de la table programs).
function ProgramRow({ program, canManage, onRename, onDelete }) {
  const [mode, setMode] = useState(null) // null | 'rename' | 'delete'
  const [name, setName] = useState(program.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const close = () => { setMode(null); setError(null) }

  const run = async (fn) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      setMode(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      {mode === 'rename' ? (
        <>
          <label className="label">Nom du programme</label>
          <input
            className="input"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !busy) run(() => onRename(program.id, name)) }}
            autoFocus
          />
          <div className="action-row" style={{ marginTop: 10 }}>
            <button className="action" onClick={close} disabled={busy}>Annuler</button>
            <button className="action primary" onClick={() => run(() => onRename(program.id, name))} disabled={busy}>
              {busy ? '...' : 'Enregistrer'}
            </button>
          </div>
        </>
      ) : (
        <Link href={`/dashboard/programme/${program.id}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong style={{ color: 'white' }}>{program.is_shared ? '🏟 ' : ''}{program.name}</strong>
            <span className="badge">{STATUS_LABELS[program.status]}</span>
          </div>
          <p className="muted" style={{ marginTop: 4 }}>Débute le {new Date(`${program.start_date}T00:00:00`).toLocaleDateString('fr-FR')}</p>
        </Link>
      )}

      {canManage && mode === null && (
        <div className="action-row" style={{ marginTop: 10 }}>
          <button className="action" onClick={() => { setName(program.name); setMode('rename') }}>✏️ Renommer</button>
          <button className="action" style={DANGER_STYLE} onClick={() => setMode('delete')}>🗑 Supprimer</button>
        </div>
      )}

      {mode === 'delete' && (
        <div style={{ marginTop: 10 }}>
          <p className="muted" style={{ fontSize: 13 }}>
            Supprimer « {program.name} » ? Les semaines, séances et blocs seront définitivement effacés.
          </p>
          <div className="action-row" style={{ marginTop: 8 }}>
            <button className="action" onClick={close} disabled={busy}>Annuler</button>
            <button className="action" style={DANGER_STYLE} onClick={() => run(() => onDelete(program.id))} disabled={busy}>
              {busy ? '...' : 'Supprimer définitivement'}
            </button>
          </div>
        </div>
      )}

      {error && <div className="errorBox" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  )
}

export default function ProgrammePage() {
  const { userId } = useCurrentUser({ redirectIfNull: true })
  const box = useBox()
  const { myPrograms, boxPrograms, athletes, loading, error, createProgram, renameProgram, deleteProgram } = useProgramsList({
    userId, boxId: box.activeBoxId, isCoach: box.isCoach,
  })
  const [creatingForSelf, setCreatingForSelf] = useState(false)
  const [creatingForAthlete, setCreatingForAthlete] = useState(null)
  const router = useRouter()
  const members = athletes.filter(a => a.role === 'member')

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

      {boxPrograms.length > 0 && (
        <>
          <h2 className="h2">Programmes de la box</h2>
          <div className="stack" style={{ gap: 8 }}>
            {boxPrograms.map(p => (
              <ProgramRow
                key={p.id}
                program={p}
                canManage={box.isCoach || p.created_by === userId}
                onRename={renameProgram}
                onDelete={deleteProgram}
              />
            ))}
          </div>
        </>
      )}

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 className="h2">Mes programmes</h2>
        <button className="action primary" onClick={() => setCreatingForSelf(v => !v)}>Programmer</button>
      </div>
      {creatingForSelf && (
        <NewProgramForm athleteId={userId} canChooseScope={box.isCoach} athletes={members} onCreate={handleCreate} onCancel={() => setCreatingForSelf(false)} />
      )}

      {myPrograms.length === 0 ? (
        <div className="card empty">Aucun programme pour l&apos;instant. Ton coach peut t&apos;en assigner un, ou tu peux en construire un toi-même.</div>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          {myPrograms.map(p => (
            <ProgramRow
              key={p.id}
              program={p}
              canManage={box.isCoach || p.created_by === userId}
              onRename={renameProgram}
              onDelete={deleteProgram}
            />
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
