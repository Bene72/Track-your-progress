'use client'
import { formatScore } from '../lib/constants'

function rankValue(score, wod) {
  switch (wod.scoring_type) {
    case 'time': return score.time_seconds ?? Infinity
    case 'rounds_reps': return -(((score.rounds ?? 0) * 10000) + (score.extra_reps ?? 0))
    case 'load': return -(score.load_kg ?? -Infinity)
    case 'reps': return -(score.reps ?? -Infinity)
    default: return 0
  }
}

export default function Leaderboard({ wod, scores, currentUserId }) {
  if (!scores || scores.length === 0) {
    return <p className="muted" style={{ padding: '12px 0' }}>Personne n’a encore posté de score.</p>
  }
  const sorted = [...scores].sort((a, b) => rankValue(a, wod) - rankValue(b, wod))
  return (
    <div>
      {sorted.map((s, i) => (
        <div key={s.id} className="leaderRow">
          <span className={`leaderRank ${i === 0 ? 'leaderRank1' : ''}`}>{i + 1}</span>
          <span className="leaderName">
            {s.profiles?.full_name || 'Adhérent'}{s.user_id === currentUserId ? ' (toi)' : ''}
          </span>
          <span className={`badge ${s.rx ? 'badgeRx' : 'badgeScaled'}`}>{s.rx ? 'RX' : 'Scaled'}</span>
          <span className="leaderScore mono">{formatScore(s, wod)}</span>
        </div>
      ))}
    </div>
  )
}
