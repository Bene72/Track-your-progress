'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { sanitizeText, boxNameSchema } from '../../lib/security'

// Un code d'invitation ressemble à "WC7BZFG" : court, tout en
// majuscules/chiffres, sans espace ni ponctuation. Un vrai nom de box
// contient presque toujours un espace ou des minuscules ("Ben&Fit Nantes").
// Ça sert uniquement à avertir l'utilisateur si il s'est trompé d'onglet,
// jamais à bloquer la création (au cas où un nom de box ressemble
// vraiment à ça).
function looksLikeInviteCode(value) {
  const v = value.trim()
  return v.length >= 4 && v.length <= 10 && /^[A-Z0-9]+$/.test(v)
}

export default function OnboardingPage() {
  const router = useRouter()
  const [tab, setTab] = useState('create') // 'create' | 'join'
  const [boxName, setBoxName] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const suspiciousBoxName = tab === 'create' && looksLikeInviteCode(boxName)

  const handleCreate = async (e) => {
    e.preventDefault()
    setError(null)

    // Garde-fou : si ça ressemble fortement à un code d'invitation,
    // on demande confirmation avant de créer une box avec ce nom.
    if (looksLikeInviteCode(boxName)) {
      const confirmed = confirm(
        `"${boxName}" ressemble à un code d'invitation plutôt qu'à un nom de box.\n\n` +
        `Si tu as reçu un code de ton coach, clique sur "Annuler" puis va sur l'onglet "J’ai un code".\n\n` +
        `Si c'est bien le nom que tu veux donner à ta box, clique sur "OK".`
      )
      if (!confirmed) return
    }

    const parsed = boxNameSchema.safeParse(boxName)
    if (!parsed.success) { setError('Nom de box invalide (2 à 60 caractères).'); return }
    setLoading(true)
    try {
      const { error } = await supabase.rpc('create_box', { box_name: sanitizeText(boxName, 60) })
      if (error) throw error
      router.push('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally { setLoading(false) }
  }

  const handleJoin = async (e) => {
    e.preventDefault()
    setError(null)
    if (!code.trim()) { setError('Entre un code d\'invitation.'); return }
    setLoading(true)
    try {
      const { error } = await supabase.rpc('join_box_via_code', { invite_code: sanitizeText(code, 40) })
      if (error) throw error
      router.push('/dashboard')
    } catch (err) {
      // Le RPC renvoie soit "Code invalide ou expiré", soit un message de
      // limitation ("Trop de tentatives...") — les deux sont sûrs à
      // afficher tels quels (pas de détail interne).
      setError(err.message || 'Code invalide ou expiré.')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div className="eyebrow">Bienvenue</div>
          <h1 className="h1">Rejoins ta box</h1>
          <p className="muted">Crée ta box en tant que coach, ou rejoins celle de ton coach avec un code.</p>
        </div>

        <div className="segmented" style={{ marginBottom: 18 }}>
          <button type="button" className={`segmentedBtn ${tab === 'create' ? 'segmentedBtnActive' : ''}`} onClick={() => setTab('create')}>Je suis coach</button>
          <button type="button" className={`segmentedBtn ${tab === 'join' ? 'segmentedBtnActive' : ''}`} onClick={() => setTab('join')}>J’ai un code</button>
        </div>

        {tab === 'create' ? (
          <form onSubmit={handleCreate} className="stack card">
            <div>
              <label>Nom de ta box</label>
              <input value={boxName} onChange={e => setBoxName(e.target.value)} placeholder="Ben&Fit Nantes" maxLength={60} required />
              {suspiciousBoxName && (
                <p className="muted" style={{ fontSize: 13, marginTop: 6, color: 'var(--accent, #ff6b35)' }}>
                  Ça ressemble à un code d’invitation. Si ton coach t’en a donné un, va plutôt sur l’onglet « J’ai un code » →
                </p>
              )}
            </div>
            {error && <div className="errorBox">{error}</div>}
            <button className="btn btnPrimary btnBlock" disabled={loading}>{loading ? '...' : 'Créer ma box'}</button>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="stack card">
            <div>
              <label>Code d’invitation</label>
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="EX: BENFIT2026" maxLength={40} required />
            </div>
            {error && <div className="errorBox">{error}</div>}
            <button className="btn btnPrimary btnBlock" disabled={loading}>{loading ? '...' : 'Rejoindre'}</button>
          </form>
        )}
      </div>
    </div>
  )
}
