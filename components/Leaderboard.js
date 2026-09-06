'use client'

import { formatScore } from '../lib/constants'

export default function Leaderboard({ wod, scores = [], currentUserId }) {
  if (!scores.length) return <p className="muted" style={{ padding: '12px 0' }}>Personne n’a encore posté de score.</p>
  const sorted = [...scores].sort((a, b) => (a.profiles?.full_name || '').localeCompare(b.profiles?.full_name || '', 'fr'))
  return <div aria-label="Scores publiés">{sorted.map((score) => <div key={score.id} className="leaderRow"><span className="leaderName">{score.profiles?.full_name || 'Adhérent'}{score.user_id === currentUserId ? ' (toi)' : ''}</span><span className={`badge ${score.rx ? 'badgeRx' : 'badgeScaled'}`}>{score.rx ? 'RX' : 'Scaled'}</span><span className="leaderScore mono">{formatScore(score, wod)}</span></div>)}</div>
}
