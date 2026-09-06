'use client'
import { useCoachDashboard } from '../../lib/hooks/usePrograms'
import Link from 'next/link'

function barColor(rate) {
  if (rate == null) return 'rgba(255,255,255,.15)'
  if (rate >= 80) return '#4ade80'
  if (rate >= 50) return '#F97316'
  return '#ef4444'
}

export default function CoachDashboardCard({ boxId, isCoach }) {
  const { rows, loading, error } = useCoachDashboard(boxId, isCoach)

  if (!isCoach) return null

  return (
    <div className="card">
      <style jsx>{`
        .cd-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,.06); }
        .cd-row:last-child { border-bottom: none; }
        .cd-name { flex: 0 0 120px; font-size: 12.5px; font-weight: 750; color: white; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cd-program { flex: 0 0 auto; font-size: 10.5px; color: rgba(255,255,255,.4); }
        .cd-track { flex: 1; height: 8px; border-radius: 999px; background: rgba(255,255,255,.06); overflow: hidden; }
        .cd-fill { height: 100%; border-radius: 999px; }
        .cd-pct { flex: 0 0 38px; text-align: right; font-size: 11.5px; font-weight: 800; color: rgba(255,255,255,.7); }
      `}</style>
      <h2 className="h2" style={{ marginBottom: 8 }}>📊 Taux de complétion — programmes actifs</h2>
      {loading && <p className="muted">Calcul en cours…</p>}
      {error && <div className="errorBox">{error}</div>}
      {!loading && !error && rows.length === 0 && (
        <p className="muted">Aucun programme actif pour l&apos;instant.</p>
      )}
      {rows.map(r => (
        <Link key={r.programId} href={`/dashboard/programme/${r.programId}`} className="cd-row" style={{ textDecoration: 'none' }}>
          <span className="cd-name">{r.athleteName}</span>
          <span className="cd-program">{r.programName}</span>
          <span className="cd-track">
            <span className="cd-fill" style={{ width: `${r.rate ?? 0}%`, background: barColor(r.rate) }} />
          </span>
          <span className="cd-pct">{r.rate == null ? '—' : `${r.rate}%`}</span>
        </Link>
      ))}
    </div>
  )
}
