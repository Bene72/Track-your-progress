'use client'

import { useState } from 'react'
import { useCurrentUser } from '../../../lib/hooks/useCurrentUser'
import { usePersonalTraining } from '../../../lib/hooks/usePersonalTraining'
import PersonalSessionCard from '../../../components/PersonalSessionCard'
import WeeklyVolumeChart from '../../../components/WeeklyVolumeChart'

const FR_WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const FR_MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

// Formatage manuel ("lundi 17 août"), volontairement sans Intl/toLocaleDateString :
// le rendu serveur (Vercel) et le rendu client peuvent différer sur la locale
// 'fr-FR' selon les données ICU disponibles, ce qui casse l'hydratation React
// (erreurs #418 / #423). Un format manuel est déterministe et identique
// des deux côtés, donc aucun besoin de passer par useEffect.
function formatDateFrLong(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const weekday = FR_WEEKDAYS[d.getDay()]
  const day = d.getDate()
  const month = FR_MONTHS[d.getMonth()]
  return `${weekday} ${day} ${month}`
}

function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function PersonalTrainingPage() {
  const { userId } = useCurrentUser({ redirectIfNull: true })
  const pt = usePersonalTraining(userId)
  const [tab, setTab] = useState('add')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  if (pt.loading) {
    return (
      <div className="personal-loading">
        <div className="personal-spinner" />
        <span>Chargement de tes séances…</span>
      </div>
    )
  }

  const dateLabel = formatDateFrLong(pt.viewDate)

  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm('Supprimer cette séance ? Cette action est irréversible.')) return
    setDeletingId(sessionId)
    try {
      await pt.deleteSession(sessionId)
    } finally {
      setDeletingId(null)
    }
  }

  const handleCreate = async () => {
    setCreating(true)
    try {
      await pt.createSession()
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="personal-page">
      <style jsx>{`
        .personal-page {
          --p-accent: var(--rx, #F97316);
          --p-accent-2: var(--accent-brd, #FDBA74);
          --p-bg: rgba(255,255,255,.035);
          --p-border: rgba(255,255,255,.09);
          --p-muted: rgba(255,255,255,.55);
          width: 100%;
          max-width: 900px;
          margin: 0 auto;
          padding-bottom: 40px;
        }

        .personal-hero {
          position: relative;
          overflow: hidden;
          padding: 28px;
          border: 1px solid var(--p-border);
          border-radius: 24px;
          background:
            radial-gradient(circle at 85% 0%, rgba(249,115,22,.22), transparent 34%),
            linear-gradient(135deg, rgba(255,255,255,.065), rgba(255,255,255,.025));
          box-shadow: 0 18px 50px rgba(0,0,0,.18);
        }

        .personal-hero::after {
          content: '';
          position: absolute;
          width: 180px;
          height: 180px;
          right: -90px;
          bottom: -110px;
          border-radius: 50%;
          background: rgba(249,115,22,.14);
          filter: blur(8px);
          pointer-events: none;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: var(--p-accent-2);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .eyebrow::before {
          content: '';
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--p-accent);
          box-shadow: 0 0 14px rgba(249,115,22,.8);
        }

        .hero-title {
          margin: 8px 0 5px;
          font-size: clamp(28px, 5vw, 42px);
          line-height: 1;
          letter-spacing: -.04em;
          font-weight: 850;
        }

        .hero-subtitle {
          margin: 0;
          color: var(--p-muted);
          font-size: 14px;
        }

        .tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          padding: 5px;
          border: 1px solid var(--p-border);
          border-radius: 15px;
          background: rgba(0,0,0,.18);
        }

        .tab {
          min-height: 44px;
          border: 0;
          border-radius: 11px;
          color: var(--p-muted);
          background: transparent;
          font: inherit;
          font-size: 13px;
          font-weight: 750;
          cursor: pointer;
          transition: .2s ease;
        }

        .tab:hover { color: white; background: rgba(255,255,255,.05); }

        .tab.active {
          color: white;
          background: linear-gradient(135deg, var(--p-accent), #C2410C);
          box-shadow: 0 8px 22px rgba(249,115,22,.25);
        }

        .date-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border: 1px solid var(--p-border);
          border-radius: 18px;
          background: var(--p-bg);
        }

        .date-nav {
          width: 40px;
          height: 40px;
          flex: 0 0 40px;
          border: 1px solid var(--p-border);
          border-radius: 12px;
          color: white;
          background: rgba(255,255,255,.04);
          font-size: 19px;
          cursor: pointer;
          transition: .2s ease;
        }

        .date-nav:hover {
          background: rgba(249,115,22,.16);
          border-color: rgba(249,115,22,.45);
          transform: translateY(-1px);
        }

        .date-center { flex: 1; text-align: center; }

        .date-label {
          margin-bottom: 5px;
          text-transform: capitalize;
          font-size: 14px;
          font-weight: 800;
        }

        .date-input {
          color: var(--p-muted);
          border: 0;
          background: transparent;
          font: inherit;
          font-size: 11px;
          cursor: pointer;
        }

        .sessions {
          display: grid;
          gap: 14px;
        }

        .session-block { position: relative; }

        .delete-session-btn {
          position: absolute;
          top: 10px;
          right: 10px;
          z-index: 2;
          padding: 6px 10px;
          border: 1px solid rgba(248,113,113,.4);
          border-radius: 10px;
          color: #fca5a5;
          background: rgba(248,113,113,.1);
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: .2s ease;
        }

        .delete-session-btn:hover:not(:disabled) {
          background: rgba(248,113,113,.2);
          border-color: rgba(248,113,113,.6);
        }

        .delete-session-btn:disabled { opacity: .55; cursor: wait; }

        .empty-state {
          padding: 38px 20px;
          border: 1px dashed var(--p-border);
          border-radius: 20px;
          text-align: center;
          background: rgba(255,255,255,.025);
        }

        .empty-icon {
          display: grid;
          place-items: center;
          width: 48px;
          height: 48px;
          margin: 0 auto 12px;
          border-radius: 15px;
          background: rgba(249,115,22,.12);
          font-size: 22px;
        }

        .empty-state p { margin: 0; color: var(--p-muted); font-size: 13px; }

        .new-session {
          width: 100%;
          min-height: 52px;
          border: 1px dashed rgba(249,115,22,.5);
          border-radius: 16px;
          color: var(--p-accent-2);
          background: rgba(249,115,22,.055);
          font: inherit;
          font-weight: 800;
          cursor: pointer;
          transition: .2s ease;
        }

        .new-session:hover:not(:disabled) {
          background: rgba(249,115,22,.12);
          border-color: var(--p-accent);
          transform: translateY(-1px);
        }

        .new-session:disabled { opacity: .55; cursor: wait; }

        .personal-loading {
          min-height: 240px;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 12px;
          color: rgba(255,255,255,.55);
          font-size: 13px;
        }

        .personal-spinner {
          width: 28px;
          height: 28px;
          border: 2px solid rgba(255,255,255,.12);
          border-top-color: var(--p-accent);
          border-radius: 50%;
          animation: personal-spin .75s linear infinite;
        }

        @keyframes personal-spin { to { transform: rotate(360deg); } }

        @media (max-width: 600px) {
          .personal-hero { padding: 22px 18px; border-radius: 20px; }
          .date-card { padding: 9px; }
          .date-nav { width: 38px; height: 38px; flex-basis: 38px; }
        }
      `}</style>

      <div className="stack" style={{ gap: 16 }}>
        <section className="personal-hero">
          <div className="eyebrow">Entraînement perso</div>
          <h1 className="hero-title">Mes séances</h1>
          <p className="hero-subtitle">Construis, suis et analyse chaque entraînement.</p>
        </section>

        <div className="tabs" role="tablist" aria-label="Vue de l'entraînement">
          <button
            className={`tab ${tab === 'add' ? 'active' : ''}`}
            onClick={() => setTab('add')}
            role="tab"
            aria-selected={tab === 'add'}
          >
            Mes séances
          </button>
          <button
            className={`tab ${tab === 'bilan' ? 'active' : ''}`}
            onClick={() => setTab('bilan')}
            role="tab"
            aria-selected={tab === 'bilan'}
          >
            Bilan volume
          </button>
        </div>

        {tab === 'add' ? (
          <>
            <div className="date-card">
              <button
                type="button"
                className="date-nav"
                onClick={() => pt.changeDate(addDaysStr(pt.viewDate, -1))}
                aria-label="Jour précédent"
              >
                ‹
              </button>

              <div className="date-center">
                <div className="date-label">{dateLabel}</div>
                <input
                  className="date-input"
                  type="date"
                  value={pt.viewDate}
                  onChange={e => pt.changeDate(e.target.value)}
                  aria-label="Choisir une date"
                />
              </div>

              <button
                type="button"
                className="date-nav"
                onClick={() => pt.changeDate(addDaysStr(pt.viewDate, 1))}
                aria-label="Jour suivant"
              >
                ›
              </button>
            </div>

            <div className="sessions">
              {pt.sessions.map(session => (
                <div key={session.id} className="session-block">
                  <button
                    type="button"
                    className="delete-session-btn"
                    onClick={() => handleDeleteSession(session.id)}
                    disabled={deletingId === session.id}
                    aria-label="Supprimer cette séance"
                  >
                    {deletingId === session.id ? '...' : '🗑 Supprimer'}
                  </button>
                  <PersonalSessionCard
                    session={session}
                    catalogByMuscle={pt.catalogByMuscle}
                    onCreateBlock={(blockType, opts) => pt.createBlock(session.id, blockType, opts)}
                    onDeleteBlock={pt.deleteBlock}
                    onAddExerciseToBlock={pt.addExerciseToBlock}
                    onRemoveExerciseFromBlock={pt.removeExerciseFromBlock}
                    onMoveExerciseToBlock={pt.moveExerciseToBlock}
                    onAddCustomExercise={pt.addCustomExercise}
                    onUpsertSetLog={pt.upsertSetLog}
                    onSetBlockResult={pt.setBlockResult}
                  />
                </div>
              ))}
            </div>

            {pt.sessions.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">＋</div>
                <p>Aucune séance ce jour-là.</p>
              </div>
            )}

            <button type="button" className="new-session" onClick={handleCreate} disabled={creating}>
              {creating ? 'Création de la séance…' : '＋  Nouvelle séance'}
            </button>
          </>
        ) : (
          <WeeklyVolumeChart volume={pt.weeklyVolume} />
        )}
      </div>
    </div>
  )
}
