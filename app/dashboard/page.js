'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useCurrentUser } from '../../lib/hooks/useCurrentUser'
import { useBox } from '../../lib/hooks/useBox'
import { useWodData } from '../../lib/hooks/useWodData'
import { useCalendarData } from '../../lib/hooks/useCalendarData'
import { useProgramsList } from '../../lib/hooks/usePrograms'
import { useGroupPrefs } from '../../lib/hooks/useGroupPrefs'
import { useSessionBlocksPreview } from '../../lib/hooks/useSessionBlocksPreview'
import { BLOCK_TYPE_ICON, blockLetter, blockSubtitle } from '../../components/personal-session/helpers'
import { localDateKey as toLocalKey } from '../../lib/date'
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
  const { getLeaderboard } = wodData
  const [editing, setEditing] = useState(false)
  const [creatingWod, setCreatingWod] = useState(false)
  const [scores, setScores] = useState([])
  const [toast, setToast] = useState(null)
  const [selectedKey, setSelectedKey] = useState(() => toLocalKey(new Date()))
  const [showGroups, setShowGroups] = useState(false)
  const [expandedItem, setExpandedItem] = useState(null)

  // Contenu perso/programme du JOUR SÉLECTIONNÉ dans le bandeau semaine,
  // filtré par les préférences "Mes groupes". Calculé avant le "return" de
  // chargement plus bas car useSessionBlocksPreview (un hook) en a besoin —
  // les hooks doivent tous s'exécuter dans le même ordre à chaque rendu,
  // jamais après un retour conditionnel.
  const isToday = selectedKey === toLocalKey(new Date())
  const selectedSession = !isToday && prefs.isVisible('perso') ? cal.sessions.find(s => s.session_date === selectedKey) : null
  const selectedProgramDays = !isToday
    ? cal.programDays.filter(p => p.date === selectedKey && prefs.isVisible(`program:${p.programId}`))
    : []
  // Le WOD "en grand" (carte + score + leaderboard) suit désormais le jour
  // sélectionné dans le bandeau semaine, pas seulement "aujourd'hui" — on le
  // pioche dans cal.wods/cal.myScores (déjà chargés pour tout le mois affiché,
  // semaines à cheval incluses) plutôt que dans useWodData qui ne connaît que
  // le jour présent.
  const selectedWod = prefs.isVisible('wod') ? cal.wods.find(w => w.wod_date === selectedKey) : null
  const mySelectedScore = selectedWod ? (cal.myScores.find(s => s.wod_id === selectedWod.id) || null) : null
  const selectedDateLabel = new Date(`${selectedKey}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const sessionPreview = useSessionBlocksPreview(expandedItem === 'perso' ? selectedSession?.id : null)

  // Toggle "aperçu" : un clic sur la ligne ouvre le détail SANS quitter
  // Aujourd'hui (pour pouvoir continuer à swiper le bandeau semaine) —
  // seul le bouton dédié dans l'aperçu navigue vraiment vers l'écran complet.
  const toggleExpanded = (key) => setExpandedItem(v => (v === key ? null : key))

  useEffect(() => { setEditing(false) }, [selectedKey])

  useEffect(() => {
    if (!selectedWod) { setScores([]); return }
    let cancelled = false
    getLeaderboard(selectedWod.id).then((s) => { if (!cancelled) setScores(s) })
    return () => { cancelled = true }
    // mySelectedScore en dépendance pour rafraîchir juste après un envoi de score.
  }, [selectedWod, mySelectedScore, getLeaderboard])

  if (box.loading || wodData.loading) {
    return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>
  }

  const handleSubmitScore = async (payload) => {
    await wodData.submitScore(selectedWod.id, payload)
    await cal.reload() // pour que cal.myScores reflète le nouveau score du jour sélectionné
    setEditing(false)
    setToast('Score enregistré 💪')
    setTimeout(() => setToast(null), 2500)
  }

  const handleCreateWod = async (payload) => {
    await wodData.createWod(payload)
    await cal.reload() // pour que le nouveau WOD apparaisse dans cal.wods (source de la carte du jour sélectionné)
    setCreatingWod(false)
    setToast(payload.status === 'published' ? 'WOD publié 💪' : 'Proposition envoyée')
    setTimeout(() => setToast(null), 2500)
  }

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
          {!selectedSession && selectedProgramDays.length === 0 && (
            <p className="muted">Rien de particulier ce jour-là côté perso/programme — le WOD éventuel s&apos;affiche plus bas.</p>
          )}
          <div className="stack" style={{ gap: 8 }}>
            {selectedSession && (
              <div className="pillarBlock">
                <button type="button" className={`pillarRow ${expandedItem === 'perso' ? 'pillarRowExpanded' : ''}`} onClick={() => toggleExpanded('perso')}>
                  <span className="pillarIcon pillarIconPerso">📓</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{selectedSession.title || 'Séance perso'}</div>
                    <div className="muted" style={{ fontSize: 11 }}>Loguée ce jour-là</div>
                  </div>
                  <span className="pillarCheck pillarCheckDone">✓</span>
                </button>
                {expandedItem === 'perso' && (
                  <div className="pillarPreview">
                    {selectedSession.notes && (
                      <p style={{ fontSize: 12.5, whiteSpace: 'pre-wrap', marginBottom: 8 }}>{selectedSession.notes}</p>
                    )}
                    {sessionPreview.loading && <p className="muted" style={{ fontSize: 12 }}>Chargement…</p>}
                    {!sessionPreview.loading && sessionPreview.error && (
                      <p className="muted" style={{ fontSize: 12 }}>Détail indisponible pour l&apos;instant.</p>
                    )}
                    {!sessionPreview.loading && !sessionPreview.error && sessionPreview.blocks.length === 0 && !selectedSession.notes && (
                      <p className="muted" style={{ fontSize: 12 }}>Pas de détail enregistré pour cette séance.</p>
                    )}
                    {!sessionPreview.loading && sessionPreview.blocks.length > 0 && (
                      <div className="stack" style={{ gap: 6 }}>
                        {sessionPreview.blocks.map((b, i) => (
                          <div key={b.id} style={{ fontSize: 12.5 }}>
                            <span style={{ fontWeight: 700 }}>
                              {blockLetter(i)}/ {BLOCK_TYPE_ICON[b.block_type]} {blockSubtitle(b)}
                            </span>
                            {b.exercises.length > 0 && (
                              <div className="muted" style={{ fontSize: 11.5 }}>
                                {b.exercises.map(be => be.exercise?.name).filter(Boolean).join(' · ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <Link href={`/dashboard/perso?date=${selectedKey}`} className="btn btnGhost btnSm" style={{ marginTop: 10 }}>
                      Ouvrir dans Perso →
                    </Link>
                  </div>
                )}
              </div>
            )}
            {selectedProgramDays.map(p => (
              <div key={p.programId} className="pillarBlock">
                <button type="button" className={`pillarRow ${expandedItem === `program:${p.programId}` ? 'pillarRowExpanded' : ''}`} onClick={() => toggleExpanded(`program:${p.programId}`)}>
                  <span className="pillarIcon pillarIconProgramme">📋</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>Programme</div>
                    <div className="muted" style={{ fontSize: 11 }}>{p.done}/{p.total} bloc{p.total !== 1 ? 's' : ''} fait{p.done !== 1 ? 's' : ''}</div>
                  </div>
                  <span className={`pillarCheck ${p.done >= p.total && p.total > 0 ? 'pillarCheckDone' : ''}`}>
                    {p.done >= p.total && p.total > 0 ? '✓' : ''}
                  </span>
                </button>
                {expandedItem === `program:${p.programId}` && (
                  <div className="pillarPreview">
                    <p style={{ fontSize: 12.5 }}>{p.done}/{p.total} bloc{p.total !== 1 ? 's' : ''} coché{p.done !== 1 ? 's' : ''} pour cette séance.</p>
                    <Link href={`/dashboard/programme/${p.programId}`} className="btn btnGhost btnSm" style={{ marginTop: 8 }}>
                      Ouvrir le programme →
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <GroupsSheet open={showGroups} onClose={() => setShowGroups(false)} myPrograms={myPrograms} prefs={prefs} />

      {creatingWod ? (
        <div className="card">
          <h3 className="h2" style={{ fontSize: 18, marginBottom: 12 }}>Ajouter un WOD</h3>
          <WodCreateForm isCoach={box.isCoach} userId={userId} onSubmit={handleCreateWod} onCancel={() => setCreatingWod(false)} initialDate={selectedKey} />
        </div>
      ) : (
        <button className="btn btnGhost btnBlock" onClick={() => setCreatingWod(true)}>+ Ajouter un WOD</button>
      )}

      {!selectedWod ? (
        !creatingWod && (
          <div className="card empty">
            <p>{isToday ? 'Aucun WOD publié aujourd’hui.' : `Aucun WOD publié pour le ${selectedDateLabel}.`}</p>
            <button type="button" className="btn btnGhost btnSm" style={{ marginTop: 10 }} onClick={() => setCreatingWod(true)}>
              + Ajouter le WOD {isToday ? 'du jour' : `du ${selectedDateLabel}`}
            </button>
          </div>
        )
      ) : (
        <>
          <WodCard wod={selectedWod} />

          {mySelectedScore && !editing ? (
            <div className="card">
              <div className="row" style={{ marginBottom: 4 }}>
                <span className="eyebrow" style={{ color: 'var(--rx)' }}>Ton score est enregistré</span>
                <button className="btn btnGhost btnSm" onClick={() => setEditing(true)}>Modifier</button>
              </div>
              <Leaderboard wod={selectedWod} scores={scores} currentUserId={userId} />
            </div>
          ) : (
            <div className="card">
              <h3 className="h2" style={{ fontSize: 18, marginBottom: 12 }}>Note ton score</h3>
              <ScoreForm
                wod={selectedWod}
                existingScore={mySelectedScore}
                onSubmit={handleSubmitScore}
                onCancel={mySelectedScore ? () => setEditing(false) : null}
              />
            </div>
          )}

          {!mySelectedScore && scores.length > 0 && (
            <div className="card">
              <h3 className="eyebrow" style={{ marginBottom: 8 }}>Déjà postés</h3>
              <Leaderboard wod={selectedWod} scores={scores} currentUserId={userId} />
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
