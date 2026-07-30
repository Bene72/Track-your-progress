'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { useCurrentUser } from '../../../lib/hooks/useCurrentUser'
import { useBox } from '../../../lib/hooks/useBox'

const PERIODS = [
  { label: '7 jours', days: 7 },
  { label: '30 jours', days: 30 },
  { label: '90 jours', days: 90 },
]

function daysAgoISO(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function formatRelative(dateStr) {
  if (!dateStr) return 'Jamais'
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Hier'
  if (diffDays < 7) return `Il y a ${diffDays} j`
  if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} sem`
  return `Il y a ${Math.floor(diffDays / 30)} mois`
}

export default function CoachDashboardPage() {
  useCurrentUser({ redirectIfNull: true })
  const box = useBox()
  const [periodDays, setPeriodDays] = useState(30)
  const [members, setMembers] = useState([])
  const [wods, setWods] = useState([])
  const [scores, setScores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!box.activeBoxId) return
    setLoading(true)
    setError(null)
    try {
      const since = daysAgoISO(periodDays)

      const [{ data: rawMembers, error: mErr }, { data: wodRows, error: wErr }] = await Promise.all([
        supabase.from('box_members').select('*').eq('box_id', box.activeBoxId).eq('status', 'active'),
        supabase.from('wods').select('id, title, wod_date, format')
          .eq('box_id', box.activeBoxId).eq('status', 'published')
          .gte('wod_date', since.slice(0, 10))
          .order('wod_date', { ascending: false }),
      ])
      if (mErr) throw mErr
      if (wErr) throw wErr

      const wodIds = (wodRows || []).map(w => w.id)
      let scoreRows = []
      if (wodIds.length > 0) {
        const { data, error: sErr } = await supabase.from('wod_scores')
          .select('id, wod_id, user_id, created_at')
          .in('wod_id', wodIds)
        if (sErr) throw sErr
        scoreRows = data || []
      }

      // Pas de FK fiable garantie entre box_members et profiles (cf. bug
      // précédent) : on récupère les profils séparément et on fusionne ici.
      let m = rawMembers || []
      const userIds = [...new Set(m.map(row => row.user_id).filter(Boolean))]
      if (userIds.length > 0) {
        const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, full_name').in('id', userIds)
        if (pErr) throw pErr
        const byId = Object.fromEntries((profiles || []).map(p => [p.id, p]))
        m = m.map(row => ({ ...row, profiles: byId[row.user_id] || null }))
      }

      // Dernière activité par membre, calculée sur TOUT l'historique (pas
      // seulement la période affichée), pour ne pas dire "Jamais" à
      // quelqu'un qui a juste posté avant le début de la fenêtre visible.
      if (userIds.length > 0) {
        const { data: lastScores } = await supabase.from('wod_scores')
          .select('user_id, created_at')
          .in('user_id', userIds)
          .order('created_at', { ascending: false })
        const lastByUser = {}
        for (const row of lastScores || []) {
          if (!lastByUser[row.user_id]) lastByUser[row.user_id] = row.created_at
        }
        m = m.map(row => ({ ...row, lastActivity: lastByUser[row.user_id] || null }))
      }

      setMembers(m)
      setWods(wodRows || [])
      setScores(scoreRows)
    } catch (e) {
      setError(e.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [box.activeBoxId, periodDays])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => {
    const totalWods = wods.length
    const scoresByUser = {}
    for (const s of scores) {
      if (!scoresByUser[s.user_id]) scoresByUser[s.user_id] = new Set()
      scoresByUser[s.user_id].add(s.wod_id)
    }

    const rows = members.map(m => {
      const posted = scoresByUser[m.user_id]?.size || 0
      const rate = totalWods > 0 ? Math.round((posted / totalWods) * 100) : null

      // Streak : nombre de WOD consécutifs (du plus récent en remontant)
      // pour lesquels ce membre a un score, jusqu'au premier trou.
      let streak = 0
      for (const w of wods) {
        if (scoresByUser[m.user_id]?.has(w.id)) streak++
        else break
      }

      return { ...m, posted, rate, streak }
    })

    const avgRate = totalWods > 0 && rows.length > 0
      ? Math.round(rows.reduce((sum, r) => sum + (r.rate || 0), 0) / rows.length)
      : null

    const atRisk = rows
      .filter(r => totalWods >= 3 && r.posted === 0)
      .sort((a, b) => new Date(a.lastActivity || 0) - new Date(b.lastActivity || 0))

    const sorted = [...rows].sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1))

    return { totalWods, avgRate, atRisk, sorted }
  }, [members, wods, scores])

  if (box.loading) {
    return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>
  }

  if (!box.isCoach) {
    return (
      <div className="stack">
        <div>
          <div className="eyebrow">{box.activeBoxName}</div>
          <h1 className="h1">Dashboard coach</h1>
        </div>
        <div className="card empty">Réservé aux coachs de la box.</div>
      </div>
    )
  }

  return (
    <div className="stack">
      <div>
        <div className="eyebrow">{box.activeBoxName}</div>
        <h1 className="h1">Dashboard coach</h1>
      </div>

      <div className="segmented">
        {PERIODS.map(p => (
          <button
            key={p.days}
            className={`segmentedBtn ${periodDays === p.days ? 'segmentedBtnActive' : ''}`}
            onClick={() => setPeriodDays(p.days)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && <div className="errorBox">{error}</div>}

      {loading ? (
        <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : (
        <>
          <div className="grid2">
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="h2" style={{ fontSize: 32 }}>{members.length}</div>
              <div className="muted" style={{ fontSize: 12 }}>Adhérents actifs</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="h2" style={{ fontSize: 32 }}>{stats.totalWods}</div>
              <div className="muted" style={{ fontSize: 12 }}>WOD publiés</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="h2" style={{ fontSize: 32, color: 'var(--rx)' }}>
                {stats.avgRate != null ? `${stats.avgRate}%` : '—'}
              </div>
              <div className="muted" style={{ fontSize: 12 }}>Participation moyenne</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="h2" style={{ fontSize: 32, color: stats.atRisk.length > 0 ? 'var(--danger)' : 'var(--chalk)' }}>
                {stats.atRisk.length}
              </div>
              <div className="muted" style={{ fontSize: 12 }}>À risque de décrochage</div>
            </div>
          </div>

          {stats.atRisk.length > 0 && (
            <div className="card">
              <h3 className="eyebrow" style={{ marginBottom: 8, color: 'var(--danger)' }}>
                Aucun score posté sur la période
              </h3>
              <div className="stack" style={{ gap: 0 }}>
                {stats.atRisk.map(m => (
                  <div key={m.id} className="leaderRow">
                    <span className="leaderName">{m.profiles?.full_name || '—'}</span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      Dernière activité : {formatRelative(m.lastActivity)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <h3 className="eyebrow" style={{ marginBottom: 8 }}>Assiduité par adhérent</h3>
            {stats.totalWods === 0 ? (
              <p className="muted">Aucun WOD publié sur cette période.</p>
            ) : (
              <div className="stack" style={{ gap: 0 }}>
                {stats.sorted.map(m => (
                  <div key={m.id} className="leaderRow">
                    <span className="leaderName">
                      {m.profiles?.full_name || '—'}
                      {m.role === 'coach' && <span className="badge badgeAccent" style={{ marginLeft: 6 }}>Coach</span>}
                    </span>
                    {m.streak >= 3 && (
                      <span className="badge" style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
                        🔥 {m.streak}
                      </span>
                    )}
                    <span className="leaderScore">{m.posted}/{stats.totalWods}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
