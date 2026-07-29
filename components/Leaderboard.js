'use client'
import { formatScore } from '../lib/constants'

// Liste des scores postés sur un WOD, SANS classement compétitif :
// pas de rang (1er/2e/3e), pas de tri par performance, pas de mise en
// avant du meilleur score. Juste "qui a posté quoi", dans l'ordre où
// c'est arrivé — l'esprit est convivial, pas la compétition.
export default function Leaderboard({ wod, scores, currentUserId }) {
  if (!scores || scores.length === 0) {
    return <p className="muted" style={{ padding: '12px 0' }}>Personne n’a encore posté de score.</p>
  }
  // Tri neutre par ordre alphabétique de prénom, pas par performance.
  const sorted = [...scores].sort((a, b) =>
    (a.profiles?.full_name || '').localeCompare(b.profiles?.full_name || '')
  )
  return (
    <div>
      {sorted.map(s => (
        <div key={s.id} className="leaderRow">
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
