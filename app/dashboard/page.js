'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useCurrentUser } from '../../lib/hooks/useCurrentUser'
import { useBox } from '../../lib/hooks/useBox'
import { useWodData } from '../../lib/hooks/useWodData'
import WodCard from '../../components/WodCard'
import ScoreForm from '../../components/ScoreForm'
import Leaderboard from '../../components/Leaderboard'

export default function DashboardHome() {
  const { userId, userName } = useCurrentUser({ redirectIfNull: true })
  const box = useBox()
  const wodData = useWodData(box.activeBoxId, userId)
  const [editing, setEditing] = useState(false)
  const [scores, setScores] = useState([])
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (wodData.todayWod) {
      wodData.getLeaderboard(wodData.todayWod.id).then(setScores)
    }
  }, [wodData.todayWod, wodData.myTodayScore])

  if (box.loading || wodData.loading) {
    return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>
  }

  const handleSubmitScore = async (payload) => {
    await wodData.submitScore(wodData.todayWod.id, payload)
    setEditing(false)
    setToast('Score enregistré 💪')
    setTimeout(() => setToast(null), 2500)
  }

  return (
    <div className="stack">
      <div>
        <div className="eyebrow">{box.activeBoxName}</div>
        <h1 className="h1">Salut {userName.split(' ')[0]}</h1>
      </div>

      {!wodData.todayWod ? (
        <div className="card empty">
          <p>Aucun WOD publié aujourd'hui.</p>
          <Link href="/dashboard/wod/new" className="btn btnPrimary" style={{ marginTop: 14 }}>Proposer le WOD du jour</Link>
        </div>
      ) : (
        <>
          <WodCard wod={wodData.todayWod} />

          {wodData.myTodayScore && !editing ? (
            <div className="card">
              <div className="row" style={{ marginBottom: 4 }}>
                <span className="eyebrow" style={{ color: 'var(--rx)' }}>Ton score est enregistré</span>
                <button className="btn btnGhost btnSm" onClick={() => setEditing(true)}>Modifier</button>
              </div>
              <Leaderboard wod={wodData.todayWod} scores={scores} currentUserId={userId} />
            </div>
          ) : (
            <div className="card">
              <h3 className="h2" style={{ fontSize: 18, marginBottom: 12 }}>Note ton score</h3>
              <ScoreForm
                wod={wodData.todayWod}
                existingScore={wodData.myTodayScore}
                onSubmit={handleSubmitScore}
                onCancel={wodData.myTodayScore ? () => setEditing(false) : null}
              />
            </div>
          )}

          {!wodData.myTodayScore && scores.length > 0 && (
            <div className="card">
              <h3 className="eyebrow" style={{ marginBottom: 8 }}>Déjà postés</h3>
              <Leaderboard wod={wodData.todayWod} scores={scores} currentUserId={userId} />
            </div>
          )}
        </>
      )}

      {box.isCoach && wodData.pending.length > 0 && (
        <Link href="/dashboard/wod/pending" className="card row" style={{ borderColor: 'var(--accent-brd)' }}>
          <span>{wodData.pending.length} WOD proposé(s) par des adhérents à valider</span>
          <span className="badge badgeAccent">Voir</span>
        </Link>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
