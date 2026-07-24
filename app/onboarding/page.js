'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { sanitizeText, boxNameSchema } from '../../lib/security'

export default function OnboardingPage() {
  const router = useRouter()
  const [tab, setTab] = useState('create') // 'create' | 'join'
  const [boxName, setBoxName] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleCreate = async (e) => {
    e.preventDefault()
    setError(null)
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
      setError('Code invalide ou expiré.')
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
          <button type="button" className={`segmentedBtn ${tab === 'join' ? 'segmentedBtnActive' : ''}`} onClick={() => setTab('join')}>J'ai un code</button>
        </div>

        {tab === 'create' ? (
          <form onSubmit={handleCreate} className="stack card">
            <div>
              <label>Nom de ta box</label>
              <input value={boxName} onChange={e => setBoxName(e.target.value)} placeholder="Ben&Fit Nantes" maxLength={60} required />
            </div>
            {error && <div className="errorBox">{error}</div>}
            <button className="btn btnPrimary btnBlock" disabled={loading}>{loading ? '...' : 'Créer ma box'}</button>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="stack card">
            <div>
              <label>Code d'invitation</label>
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
