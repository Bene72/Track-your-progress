'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { useCurrentUser } from '../../../lib/hooks/useCurrentUser'
import { useBox } from '../../../lib/hooks/useBox'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 7

// Génération cryptographiquement sûre (Math.random() n'est pas fiable pour
// un secret, même court) via l'API Web Crypto disponible dans tous les
// navigateurs modernes.
function randomCode(length = CODE_LENGTH) {
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => CODE_CHARS[b % CODE_CHARS.length]).join('')
}

// Mots vides à ignorer pour ne pas polluer les initiales (articles, "by", etc.)
const STOPWORDS = new Set(['BY', 'DE', 'DU', 'LA', 'LE', 'LES', 'ET', 'AND', 'THE'])

// Suggestion de code basée sur le nom de la box : initiales des mots
// significatifs, complétées par des caractères aléatoires jusqu'à
// CODE_LENGTH. Reste éditable par le coach avant validation.
function codeFromBoxName(name, length = CODE_LENGTH) {
  const words = (name || '')
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // enlève les accents
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(w => !STOPWORDS.has(w))

  let prefix = words.map(w => w[0]).join('').slice(0, length)
  if (prefix.length < 3) prefix = (prefix + randomCode(length)).slice(0, Math.max(3, prefix.length))

  const remaining = Math.max(0, length - prefix.length)
  const suffix = remaining > 0 ? randomCode(remaining) : ''
  return (prefix + suffix).slice(0, length)
}

const INVITE_DURATIONS = [
  { label: '7 jours', days: 7 },
  { label: '30 jours', days: 30 },
  { label: '90 jours', days: 90 },
]

export default function BoxPage() {
  const router = useRouter()
  const { userId } = useCurrentUser({ redirectIfNull: true })
  const box = useBox()
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [inviteDays, setInviteDays] = useState(7)
  const [inviteMaxUses, setInviteMaxUses] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [codeTouched, setCodeTouched] = useState(false)
  const [inviteError, setInviteError] = useState(null)

  const load = useCallback(async () => {
    if (!box.activeBoxId) return
    setLoading(true)
    const [{ data: m }, { data: inv }] = await Promise.all([
      supabase.from('box_members').select('*, profiles!box_members_user_id_fkey!left ( full_name )').eq('box_id', box.activeBoxId).eq('status', 'active'),
      box.isCoach
        ? supabase.from('box_invites').select('*').eq('box_id', box.activeBoxId).eq('active', true).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ])
    setMembers(m || [])
    setInvites(inv || [])
    setLoading(false)
  }, [box.activeBoxId, box.isCoach])

  useEffect(() => { load() }, [load])

  // Pré-remplit le champ code avec une suggestion basée sur le nom de la box,
  // tant que le coach n'a pas commencé à l'éditer lui-même.
  useEffect(() => {
    if (!codeTouched && box.activeBoxName) {
      setInviteCode(codeFromBoxName(box.activeBoxName))
    }
  }, [box.activeBoxName, codeTouched])

  const regenerateSuggestion = () => {
    setInviteCode(codeFromBoxName(box.activeBoxName))
    setCodeTouched(false)
  }

  const handleCodeChange = (e) => {
    const cleaned = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
    setInviteCode(cleaned)
    setCodeTouched(true)
  }

  const handleCreateInvite = async () => {
    setCreatingInvite(true)
    setInviteError(null)
    try {
      const code = (inviteCode || '').trim() || randomCode()
      if (code.length < 4) {
        setInviteError('Le code doit faire au moins 4 caractères.')
        setCreatingInvite(false)
        return
      }
      const expiresAt = new Date(Date.now() + inviteDays * 24 * 60 * 60 * 1000).toISOString()
      const maxUses = inviteMaxUses ? parseInt(inviteMaxUses, 10) : null
      const { error } = await supabase.from('box_invites').insert({
        box_id: box.activeBoxId,
        code,
        created_by: userId,
        role: 'member',
        expires_at: expiresAt,
        max_uses: maxUses,
      })
      if (error) throw error
      await load()
      // Prépare une nouvelle suggestion pour le prochain code
      setInviteCode(codeFromBoxName(box.activeBoxName))
      setCodeTouched(false)
    } catch (e) {
      setInviteError(e.message?.includes('duplicate') ? 'Ce code existe déjà, choisis-en un autre.' : e.message)
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
            <h3 className="eyebrow">Codes d’invitation</h3>
          </div>
          <div className="row" style={{ marginBottom: 8, gap: 8 }}>
            <select className="input" value={inviteDays} onChange={e => setInviteDays(Number(e.target.value))}>
              {INVITE_DURATIONS.map(d => <option key={d.days} value={d.days}>{d.label}</option>)}
            </select>
            <input
              className="input"
              type="number"
              min="1"
              placeholder="Usages max (vide = illimité)"
              value={inviteMaxUses}
              onChange={e => setInviteMaxUses(e.target.value)}
            />
          </div>
          <div className="row" style={{ marginBottom: 12, gap: 8 }}>
            <input
              className="input mono"
              style={{ letterSpacing: 2, fontWeight: 700 }}
              value={inviteCode}
              onChange={handleCodeChange}
              maxLength={12}
              placeholder="CODE"
            />
            <button type="button" className="btn btnGhost btnSm" onClick={regenerateSuggestion} title="Générer une nouvelle suggestion">
              🔀
            </button>
            <button className="btn btnPrimary btnSm" onClick={handleCreateInvite} disabled={creatingInvite}>+ Code</button>
          </div>
          {inviteError && <div className="errorBox" style={{ marginBottom: 12 }}>{inviteError}</div>}
          {invites.length === 0 ? (
            <p className="muted">Aucun code actif. Génère-en un pour tes adhérents.</p>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              {invites.map(inv => {
                const expired = inv.expires_at && new Date(inv.expires_at) < new Date()
                const exhausted = inv.max_uses != null && inv.uses_count >= inv.max_uses
                return (
                  <div key={inv.id} className="row">
                    <div>
                      <span className="mono" style={{ fontWeight: 700, letterSpacing: 2 }}>{inv.code}</span>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {expired || exhausted ? (
                          <span style={{ color: 'var(--danger, #e5484d)' }}>{expired ? 'Expiré' : 'Quota atteint'}</span>
                        ) : (
                          <>
                            Expire le {new Date(inv.expires_at).toLocaleDateString('fr-FR')}
                            {inv.max_uses != null && ` · ${inv.uses_count}/${inv.max_uses} usages`}
                          </>
                        )}
                      </div>
                    </div>
                    <button className="btn btnGhost btnSm" onClick={() => navigator.clipboard?.writeText(inv.code)} disabled={expired || exhausted}>Copier</button>
                  </div>
                )
              })}
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
