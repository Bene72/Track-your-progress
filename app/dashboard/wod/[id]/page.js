'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'
import { WOD_COLUMNS, WOD_SCORE_COLUMNS } from '../../../../lib/db-columns'
import { useCurrentUser } from '../../../../lib/hooks/useCurrentUser'
import { useBox } from '../../../../lib/hooks/useBox'
import WodCard from '../../../../components/WodCard'
import WodEditForm from '../../../../components/WodEditForm'
import ScoreForm from '../../../../components/ScoreForm'
import Leaderboard from '../../../../components/Leaderboard'
import BoxChat from '../../../../components/BoxChat'

export default function WodDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { userId } = useCurrentUser({ redirectIfNull: true })
  const box = useBox()
  const [wod, setWod] = useState(null)
  const [scores, setScores] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editingWod, setEditingWod] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: wodRow, error: wodError }, { data: scoreRows, error: scoreError }] = await Promise.all([
      supabase.from('wods').select(WOD_COLUMNS).eq('id', id).single(),
      supabase.from('wod_scores').select(WOD_SCORE_COLUMNS).eq('wod_id', id),
    ])
    if (wodError) console.error('Erreur chargement WOD:', wodError.message)
    if (scoreError) console.error('Erreur chargement scores:', scoreError.message)

    // Pas de FK fiable garantie entre wod_scores et profiles : on récupère
    // les profils correspondants séparément et on fusionne ici plutôt que
    // de compter sur l'embedding PostgREST (qui échoue silencieusement en
    // 400 si la relation n'est pas déclarée en base).
    let s = scoreRows || []
    const userIds = [...new Set(s.map(row => row.user_id).filter(Boolean))]
    if (userIds.length > 0) {
      const { data: profiles, error: profError } = await supabase.from('profiles').select('id, full_name').in('id', userIds)
      if (profError) console.error('Erreur chargement profils:', profError.message)
      const byId = Object.fromEntries((profiles || []).map(p => [p.id, p]))
      s = s.map(row => ({ ...row, profiles: byId[row.user_id] || null }))
    }

    setWod(wodRow || null)
    setScores(s)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>
  if (!wod) return <div className="card empty">WOD introuvable.</div>

  const myScore = scores.find(s => s.user_id === userId) || null
  // Seul l'auteur du WOD ou le coach de la box peut le modifier ou le supprimer.
  const canEdit = wod.created_by === userId || box.isCoach

  const handleUpdateWod = async (payload) => {
    // Update ciblé sur la ligne du WOD uniquement (table `wods`). La table
    // `wod_scores` référence ce WOD par wod_id, qui ne change pas : les
    // scores et notes déjà postés par les adhérents restent intacts.
    const { error } = await supabase.from('wods').update(payload).eq('id', wod.id)
    if (error) throw error
    setEditingWod(false)
    await load()
  }

  const handleSubmit = async (payload) => {
    const { error } = await supabase.from('wod_scores')
      .upsert({ ...payload, wod_id: wod.id, box_id: wod.box_id, user_id: userId }, { onConflict: 'wod_id,user_id' })
    if (error) throw error
    setEditing(false)
    await load()
  }

  const handleDelete = async () => {
    if (!confirm(`Supprimer "${wod.title}" ? Cette action est irréversible.`)) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const { error } = await supabase.from('wods').delete().eq('id', wod.id)
      if (error) throw error
      router.push('/dashboard/wod')
    } catch (e) {
      setDeleteError(e.message || 'Erreur lors de la suppression')
      setDeleting(false)
    }
  }

  return (
    <div className="stack">
      {editingWod ? (
        <div className="card">
          <h3 className="h2" style={{ fontSize: 18, marginBottom: 12 }}>Modifier le WOD</h3>
          <WodEditForm wod={wod} userId={userId} onSubmit={handleUpdateWod} onCancel={() => setEditingWod(false)} />
        </div>
      ) : (
        <WodCard wod={wod} />
      )}

      {canEdit && !editingWod && (
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btnGhost" style={{ flex: 1 }} onClick={() => setEditingWod(true)}>
            Modifier ce WOD
          </button>
          <button
            className="btn btnGhost"
            style={{ flex: 1, color: 'var(--rx, #e5484d)', borderColor: 'rgba(229,72,77,0.4)' }}
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Suppression...' : 'Supprimer ce WOD'}
          </button>
        </div>
      )}
      {deleteError && <div className="errorBox">{deleteError}</div>}

      {myScore && !editing ? (
        <div className="card">
          <div className="row" style={{ marginBottom: 4 }}>
            <span className="eyebrow" style={{ color: 'var(--rx)' }}>Ton score</span>
            <button className="btn btnGhost btnSm" onClick={() => setEditing(true)}>Modifier</button>
          </div>
        </div>
      ) : (
        <div className="card">
          <h3 className="h2" style={{ fontSize: 18, marginBottom: 12 }}>{myScore ? 'Modifier mon score' : 'Poster mon score'}</h3>
          <ScoreForm wod={wod} existingScore={myScore} onSubmit={handleSubmit} onCancel={myScore ? () => setEditing(false) : null} />
        </div>
      )}

      <div className="card">
        <h3 className="eyebrow" style={{ marginBottom: 8 }}>Scores postés ({scores.length})</h3>
        <Leaderboard wod={wod} scores={scores} currentUserId={userId} />
      </div>

      <BoxChat boxId={wod.box_id} userId={userId} wodId={wod.id} title="💬 Discussion sur ce WOD" height={360} />
    </div>
  )
}
