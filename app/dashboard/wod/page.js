'use client'
import Link from 'next/link'
import { useCurrentUser } from '../../../lib/hooks/useCurrentUser'
import { useBox } from '../../../lib/hooks/useBox'
import { useWodData } from '../../../lib/hooks/useWodData'
import { WOD_FORMAT_LABELS } from '../../../lib/constants'

export default function WodFeedPage() {
  const { userId } = useCurrentUser({ redirectIfNull: true })
  const box = useBox()
  const wodData = useWodData(box.activeBoxId, userId)

  if (box.loading || wodData.loading) {
    return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>
  }

  return (
    <div className="stack">
      <div className="row">
        <h1 className="h1">Le tableau</h1>
        <Link href="/dashboard/wod/new" className="btn btnPrimary btnSm">+ WOD</Link>
      </div>

      {box.isCoach && wodData.pending.length > 0 && (
        <Link href="/dashboard/wod/pending" className="card row" style={{ borderColor: 'var(--accent-brd)' }}>
          <span>{wodData.pending.length} proposition(s) en attente</span>
          <span className="badge badgeAccent">Valider</span>
        </Link>
      )}

      {wodData.feed.length === 0 ? (
        <div className="card empty">Aucun WOD publié pour l'instant.</div>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {wodData.feed.map(w => (
            <Link key={w.id} href={`/dashboard/wod/${w.id}`} className="card">
              <div className="row" style={{ marginBottom: 6 }}>
                <span className="muted mono" style={{ fontSize: 12 }}>
                  {new Date(w.wod_date + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                </span>
                <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: '#A9ADB8' }}>{WOD_FORMAT_LABELS[w.format]}</span>
              </div>
              <div style={{ fontWeight: 700 }}>{w.title}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
