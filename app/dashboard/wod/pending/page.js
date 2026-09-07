'use client'
import { useCurrentUser } from '../../../../lib/hooks/useCurrentUser'
import { useBox } from '../../../../lib/hooks/useBox'
import { useWodData } from '../../../../lib/hooks/useWodData'
import WodCard from '../../../../components/WodCard'

export default function PendingWodsPage() {
  const { userId } = useCurrentUser({ redirectIfNull: true })
  const box = useBox()
  const wodData = useWodData(box.activeBoxId, userId)

  if (box.loading || wodData.loading) {
    return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>
  }

  if (!box.isCoach) {
    return <div className="card empty">Réservé au coach de la box.</div>
  }

  return (
    <div className="stack">
      <h1 className="h1">Propositions</h1>
      {wodData.pending.length === 0 ? (
        <div className="card empty">Aucune proposition en attente.</div>
      ) : (
        <div className="stack">
          {wodData.pending.map(w => (
            <div key={w.id} className="stack">
              <WodCard wod={w} />
              <div className="row" style={{ gap: 10 }}>
                <button className="btn btnGhost btnBlock" onClick={() => wodData.decideWod(w.id, 'rejected')}>Refuser</button>
                <button className="btn btnPrimary btnBlock" onClick={() => wodData.decideWod(w.id, 'published')}>Publier</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
