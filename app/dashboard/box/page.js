'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { useCurrentUser } from '../../../lib/hooks/useCurrentUser'
import { useBox } from '../../../lib/hooks/useBox'

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 7 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function BoxPage() {
  const router = useRouter()
  const { userId } = useCurrentUser({ redirectIfNull: true })
  const box = useBox()
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [creatingInvite, setCreatingInvite] = useState(false)

  const load = useCallback(async () => {
    if (!box.activeBoxId) return
    setLoading(true)
    const [{ data: m }, { data: inv }] = await Promise.all([
      supabase.from('box_members').select('*, profiles ( full_name )').eq('box_id', box.activeBoxId).eq('status', 'active'),
      box.isCoach
        ? supabase.from('box_invites').select('*').eq('box_id', box.activeBoxId).eq('active', true).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ])
    setMembers(m || [])
    setInvites(inv || [])
    setLoading(false)
  }, [box.activeBoxId, box.isCoach])

  useEffect(() => { load() }, [load])

  const handleCreateInvite = async () => {
    setCreatingInvite(true)
    try {
      const code = randomCode()
      const { error } = await supabase.from('box_invites').insert({ box_id: box.activeBoxId, code, created_by: userId, role: 'member' })
      if (error) throw error
      await load()
    } catch (e) {
      alert(e.message)
    } finally { setCreatingInvite(false) }
  }

  const handleLeave = async () => {
    if (!confirm(`Quitter ${box.activeBoxName} ?`)) return
    await supabase.from('box_members').delete().eq('box_id', box.activeBoxId).eq('user_id', userId)
    router.push('/onboarding')
  }

  if (box.loading || loading) return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>

  return (
    <div className="stack">
      <div>
        <div className="eyebrow">Ma box</div>
        <h1 className="h1">{box.activeBoxName}</h1>
      </div>

      {box.memberships.length > 1 && (
        <div className="card">
          <h3 className="eyebrow" style={{ marginBottom: 8 }}>Changer de box</h3>
          <div className="stack" style={{ gap: 8 }}>
            {box.memberships.map(m => (
              <button key={m.box_id} className={`btn ${m.box_id === box.activeBoxId ? 'btnPrimary' : 'btnGhost'} btnBlock`} onClick={() => box.switchBox(m.box_id)}>
                {m.boxes.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {box.isCoach && (
        <div className="card">
          <div className="row" style={{ marginBottom: 8 }}>
            <h3 className="eyebrow">Codes d'invitation</h3>
            <button className="btn btnPrimary btnSm" onClick={handleCreateInvite} disabled={creatingInvite}>+ Code</button>
          </div>
          {invites.length === 0 ? (
            <p className="muted">Aucun code actif. Génère-en un pour tes adhérents.</p>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              {invites.map(inv => (
                <div key={inv.id} className="row">
                  <span className="mono" style={{ fontWeight: 700, letterSpacing: 2 }}>{inv.code}</span>
                  <button className="btn btnGhost btnSm" onClick={() => navigator.clipboard?.writeText(inv.code)}>Copier</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h3 className="eyebrow" style={{ marginBottom: 8 }}>Adhérents ({members.length})</h3>
        <div className="stack" style={{ gap: 0 }}>
          {members.map(m => (
            <div key={m.id} className="leaderRow">
              <span className="leaderName">{m.profiles?.full_name || '—'}{m.user_id === userId ? ' (toi)' : ''}</span>
              {m.role === 'coach' && <span className="badge badgeAccent">Coach</span>}
            </div>
          ))}
        </div>
      </div>

      <button className="btn btnGhost btnBlock" onClick={handleLeave}>Quitter cette box</button>
    </div>
  )
}
