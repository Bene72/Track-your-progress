'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useCurrentUser } from '../../lib/hooks/useCurrentUser'
import { useBox } from '../../lib/hooks/useBox'
import { useWodData } from '../../lib/hooks/useWodData'
import { useCalendarData } from '../../lib/hooks/useCalendarData'
import { useProgramsList } from '../../lib/hooks/usePrograms'
import { useGroupPrefs } from '../../lib/hooks/useGroupPrefs'
import { localDateKey as toLocalKey } from '../../lib/date'
import { WOD_FORMAT_LABELS } from '../../lib/constants'
import WodCard from '../../components/WodCard'
import WodCreateForm from '../../components/WodCreateForm'
import ScoreForm from '../../components/ScoreForm'
import Leaderboard from '../../components/Leaderboard'
import WeekStrip from '../../components/WeekStrip'
import GroupsSheet from '../../components/GroupsSheet'

export default function DashboardHome() {
  const { userId, userName } = useCurrentUser({ redirectIfNull: true })
  const box = useBox()
  const wodData = useWodData(box.activeBoxId, userId)
  const cal = useCalendarData(box.activeBoxId, userId)
  const { myPrograms } = useProgramsList({ userId, boxId: box.activeBoxId, isCoach: box.isCoach })
  const prefs = useGroupPrefs(userId)
  const { todayWod, myTodayScore, getLeaderboard } = wodData
  const [editing, setEditing] = useState(false)
  const [creatingWod, setCreatingWod] = useState(false)
  const [scores, setScores] = useState([])
  const [toast, setToast] = useState(null)
  const [selectedKey, setSelectedKey] = useState(() => toLocalKey(new Date()))
  const [showGroups, setShowGroups] = useState(false)

  useEffect(() => {
    if (todayWod) {
      getLeaderboard(todayWod.id).then(setScores)
    }
  }, [todayWod, myTodayScore, getLeaderboard])

  if (box.loading || wodData.loading) {
    return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>
  }

  const handleSubmitScore = async (payload) => {
    await wodData.submitScore(wodData.todayWod.id, payload)
    setEditing(false)
    setToast('Score enregistré 💪')
    setTimeout(() => setToast(null), 2500)
  }

  const handleCreateWod = async (payload) => {
    await wodData.createWod(payload)
    setCreatingWod(false)
    setToast(payload.status === 'published' ? 'WOD publié 💪' : 'Proposition envoyée')
    setTimeout(() => setToast(null), 2500)
  }

  // Contenu perso/programme du JOUR SÉLECTIONNÉ dans le bandeau semaine
  // (le WOD ci-dessous reste volontairement lié à "aujourd'hui" seulement —
  // c'est un flux à part, alimenté par useWodData qui ne connaît que le jour
  // présent). Filtré par les préférences "Mes groupes".
  const isToday = selectedKey === toLocalKey(new Date())
  const selectedSession = !isToday && prefs.isVisible('perso') ? cal.sessions.find(s => s.session_date === selectedKey) : null
  const selectedProgramDays = !isToday
    ? cal.programDays.filter(p => p.date === selectedKey && prefs.isVisible(`program:${p.programId}`))
    : []
  const selectedWod = !isToday && prefs.isVisible('wod') ? cal.wods.find(w => w.wod_date === selectedKey) : null

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="eyebrow">{box.activeBoxName}</div>
          <h1 className="h1">Salut {userName.split(' ')[0]}</h1>
        </div>
      </div>

      <WeekStrip cal={cal} prefs={prefs} selectedKey={selectedKey} onSelect={setSelectedKey} />

      <button type="button" className="groupsBtn" onClick={() => setShowGroups(true)}>
        <span>📂 Mes groupes affichés</span>
        <span className="muted">›</span>
      </button>

      {!isToday && (
        <div className="card">
          <h3 className="eyebrow" style={{ marginBottom: 8 }}>
            {new Date(`${selectedKey}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </h3>
          {!selectedWod && !selectedSession && selectedProgramDays.length === 0 && (
            <p className="muted">Rien de particulier ce jour-là.</p>
          )}
          <div className="stack" style={{ gap: 8 }}>
            {selectedWod && (
              <Link href={`/dashboard/wod/${selectedWod.id}`} className="pillarRow">
                <span className="pillarIcon pillarIconWod">🏋️</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{selectedWod.title}</div>
                  <div className="muted" style={{ fontSize: 11 }}>WOD de box — {WOD_FORMAT_LABELS[selectedWod.format]}</div>
                </div>
              </Link>
            )}
            {selectedSession && (
              <Link href="/dashboard/perso" className="pillarRow">
                <span className="pillarIcon pillarIconPerso">📓</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Séance perso</div>
                  <div className="muted" style={{ fontSize: 11 }}>Loguée ce jour-là</div>
                </div>
                <span className="pillarCheck pillarCheckDone">✓</span>
              </Link>
            )}
            {selectedProgramDays.map(p => (
              <Link key={p.programId} href={`/dashboard/programme/${p.programId}`} className="pillarRow">
                <span className="pillarIcon pillarIconProgramme">📋</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Programme</div>
                  <div className="muted" style={{ fontSize: 11 }}>{p.done}/{p.total} bloc{p.total !== 1 ? 's' : ''} fait{p.done !== 1 ? 's' : ''}</div>
                </div>
                <span className={`pillarCheck ${p.done >= p.total && p.total > 0 ? 'pillarCheckDone' : ''}`}>
                  {p.done >= p.total && p.total > 0 ? '✓' : ''}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <GroupsSheet open={showGroups} onClose={() => setShowGroups(false)} myPrograms={myPrograms} prefs={prefs} />

      {creatingWod ? (
        <div className="card">
          <h3 className="h2" style={{ fontSize: 18, marginBottom: 12 }}>Ajouter un WOD</h3>
          <WodCreateForm isCoach={box.isCoach} userId={userId} onSubmit={handleCreateWod} onCancel={() => setCreatingWod(false)} />
        </div>
      ) : (
        <button className="btn btnGhost btnBlock" onClick={() => setCreatingWod(true)}>+ Ajouter un WOD</button>
      )}

      {!wodData.todayWod ? (
        !creatingWod && (
          <div className="card empty">
            <p>Aucun WOD publié aujourd’hui.</p>
          </div>
        )
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
