'use client'
import { WOD_FORMAT_LABELS } from '../lib/constants'

export default function WodCard({ wod }) {
  const dateLabel = new Date(wod.wod_date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <div className="wodCard">
      <div className="row" style={{ marginBottom: 10 }}>
        <span className="eyebrow">{dateLabel}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {wod.is_benchmark && <span className="badge badgeAccent">Benchmark</span>}
          <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: '#A9ADB8' }}>{WOD_FORMAT_LABELS[wod.format]}</span>
        </div>
      </div>
      <h2 className="h2" style={{ marginBottom: 8 }}>{wod.title}</h2>
      {wod.format === 'emom' && wod.emom_rounds && (
        <p className="muted mono" style={{ marginBottom: 6 }}>EMOM {wod.emom_interval_sec}s × {wod.emom_rounds}</p>
      )}
      {wod.time_cap_sec && (
        <p className="muted mono" style={{ marginBottom: 6 }}>Cap: {Math.round(wod.time_cap_sec / 60)} min</p>
      )}
      <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#E8E5DC' }}>{wod.description}</p>
    </div>
  )
}
