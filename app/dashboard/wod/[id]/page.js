'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'
import { useCurrentUser } from '../../../../lib/hooks/useCurrentUser'
import { useBox } from '../../../../lib/hooks/useBox'
import WodCard from '../../../../components/WodCard'
import ScoreForm from '../../../../components/ScoreForm'
import Leaderboard from '../../../../components/Leaderboard'

export default function WodDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { userId } = useCurrentUser({ redirectIfNull: true })
  const box = useBox()
  const [wod, setWod] = useState(null)
  const [scores, setScores] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: wodRow }, { data: scoreRows }] = await Promise.all([
      supabase.from('wods').select('*').eq('id', id).single(),
      supabase.from('wod_scores').select('*, profiles ( full_name )').eq('wod_id', id),
    ])
    setWod(wodRow || null)
    setScores(scoreRows || [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>
  if (!wod) return <div className="card empty">WOD introuvable.</div>

  const myScore = scores.find(s => s.user_id === userId) || null
  // Seul l'auteur du WOD ou le coach de la box peut le supprimer.
  const canDelete = wod.created_by === userId || box.isCoach

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
    try {
      const { error } = await supabase.from('wods').delete().eq('id', wod.id)
      if (error) throw error
      router.push('/dashboard/wod')
    } catch (e) {
      alert(e.message || 'Erreur lors de la suppression')
      setDeleting(false)
    }
  }

  return (
    <div className="stack">
      <WodCard wod={wod} />

      {canDelete && (
        <button
          className="btn btnGhost btnBlock"
          style={{ color: 'var(--rx, #e5484d)', borderColor: 'rgba(229,72,77,0.4)' }}
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? 'Suppression...' : 'Supprimer ce WOD'}
        </button>
      )}

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
        <h3 className="eyebrow" style={{ marginBottom: 8 }}>Classement ({scores.length})</h3>
        <Leaderboard wod={wod} scores={scores} currentUserId={userId} />
      </div>
    </div>
  )
}
