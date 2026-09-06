'use client'
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS } from '../lib/constants'

// volume: { [muscle_group]: nombreDeSeries } sur les 7 derniers jours glissants
export default function WeeklyVolumeChart({ volume }) {
  const entries = MUSCLE_GROUPS
    .map(m => ({ ...m, count: volume[m.value] || 0 }))
    .filter(m => m.count > 0)
    .sort((a, b) => b.count - a.count)

  const max = Math.max(...entries.map(e => e.count), 1)

  if (entries.length === 0) {
    return <p className="muted" style={{ fontSize: 13, textAlign: 'center', padding: '1rem 0' }}>Aucune série enregistrée sur les 7 derniers jours.</p>
  }

  return (
    <div className="card stack" style={{ gap: 14 }}>
      <span className="eyebrow">Séries sur les 7 derniers jours</span>
      {entries.map(e => (
        <div key={e.value}>
          <div className="row" style={{ fontSize: 13, marginBottom: 4 }}>
            <span>{MUSCLE_GROUP_LABELS[e.value] || e.label}</span>
            <span className="muted">{e.count} séries</span>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.round((e.count / max) * 100)}%`, background: 'var(--rx, #1D9E75)' }} />
          </div>
        </div>
      ))}
    </div>
  )
}
