'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { sanitizeText, passwordSchema } from '../../lib/security'

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageInner />
    </Suspense>
  )
}

function AuthPageInner() {
  const router = useRouter()
  const params = useSearchParams()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null); setInfo(null); setLoading(true)
    try {
      if (mode === 'signup') {
        const pwCheck = passwordSchema.safeParse(password)
        if (!pwCheck.success) {
          setError(pwCheck.error.issues[0].message)
          setLoading(false)
          return
        }
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: sanitizeText(fullName, 80) } },
        })
        if (error) throw error
        setInfo('Compte créé. Vérifie ta boîte mail pour confirmer, puis connecte-toi.')
        setMode('login')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        router.push(params.get('next') || '/dashboard')
      }
    } catch (err) {
      setError(err.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect.' : err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div className="logo" style={{ fontSize: 34 }}>BOX<span>LOG</span></div>
          <p className="muted">Le WOD du jour. Ton score. Tes PR.</p>
        </div>

        <div className="segmented" style={{ marginBottom: 20 }}>
          <button type="button" className={`segmentedBtn ${mode === 'login' ? 'segmentedBtnActive' : ''}`} onClick={() => setMode('login')}>Connexion</button>
          <button type="button" className={`segmentedBtn ${mode === 'signup' ? 'segmentedBtnActive' : ''}`} onClick={() => setMode('signup')}>Inscription</button>
        </div>

        <form onSubmit={handleSubmit} className="stack card">
          {mode === 'signup' && (
            <div>
              <label>Nom complet</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)} required maxLength={80} placeholder="Jean Dupont" />
            </div>
          )}
          <div>
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="toi@exemple.com" />
          </div>
          <div>
            <label>Mot de passe</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
          </div>
          {error && <div className="errorBox">{error}</div>}
          {info && <div className="badge badgeRx" style={{ display: 'block', padding: '10px 12px' }}>{info}</div>}
          <button type="submit" className="btn btnPrimary btnBlock" disabled={loading}>
            {loading ? '...' : mode === 'login' ? 'Se connecter' : "Créer mon compte"}
          </button>
        </form>
      </div>
    </div>
  )
}
