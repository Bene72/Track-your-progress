'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useCurrentUser } from '../../../../lib/hooks/useCurrentUser'
import { useBox } from '../../../../lib/hooks/useBox'
import { useProgram, useExerciseCatalog, createPersonalExercise, useProgramsList } from '../../../../lib/hooks/usePrograms'
import { formatSessionDateLabel, DAY_LABELS } from '../../../../lib/program-date'
import { defaultMuscleGroup } from '../../../../components/personal-session/helpers'
import { getBlockType } from '../../../../lib/blockTypes'
import ProgramBlockCard from '../../../../components/program/ProgramBlockCard'
import AddBlockForm from '../../../../components/program/AddBlockForm'
import DuplicateToAthleteForm from '../../../../components/program/DuplicateToAthleteForm'
import { supabase } from '../../../../lib/supabase'

const STATUS_LABELS = { draft: 'Brouillon', active: 'Actif', completed: 'Terminé', archived: 'Archivé' }
const PERIOD_LABELS = { AM: 'Matin', PM: 'Soir', unique: 'Séance' }

// Menu "•••" pour les actions sur la semaine active (Dupliquer / Supprimer)
// — remplace 2 boutons toujours visibles par un menu compact, cf. retours UX.
function WeekMenu({ onDuplicate, onDelete, canDelete, busy }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div className="kebab" ref={ref}>
      <button type="button" className="kebabBtn" disabled={busy} onClick={() => setOpen(v => !v)} aria-label="Actions semaine">•••</button>
      {open && (
        <div className="kebabPanel">
          <button type="button" className="kebabItem" onClick={() => { setOpen(false); onDuplicate() }}>📋 Dupliquer cette semaine</button>
          {canDelete && (
            <button type="button" className="kebabItem danger" onClick={() => { setOpen(false); onDelete() }}>🗑 Supprimer cette semaine</button>
          )}
        </div>
      )}
    </div>
  )
}

export default function ProgramDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { userId } = useCurrentUser({ redirectIfNull: true })
  const box = useBox()
  const {
    program, weeks, loading, error, canEditStructure,
    addWeek, duplicateWeek, deleteWeek, addSession, deleteSession,
    addBlock, updateBlock, deleteBlock, upsertMyLog, setStatus, duplicateToAthlete,
  } = useProgram(id, userId)
  const { catalog } = useExerciseCatalog(userId)
  const { athletes } = useProgramsList({ userId, boxId: box.activeBoxId, isCoach: box.isCoach })

  const [activeWeekId, setActiveWeekId] = useState(null)
  const [activeDay, setActiveDay] = useState(0)
  const [activePeriod, setActivePeriod] = useState('AM')
  const [athleteName, setAthleteName] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [showDuplicateForm, setShowDuplicateForm] = useState(false)

  useEffect(() => {
    if (weeks.length && !activeWeekId) setActiveWeekId(weeks[0].id)
  }, [weeks, activeWeekId])

  useEffect(() => {
    async function loadAthlete() {
      if (!program?.athlete_id) return
      const { data } = await supabase.from('profiles').select('full_name').eq('id', program.athlete_id).maybeSingle()
      setAthleteName(data?.full_name || '')
    }
    loadAthlete()
  }, [program?.athlete_id])

  const canEdit = program ? canEditStructure(userId, box.isCoach) : false
  const isAthleteView = program?.athlete_id === userId

  const activeWeek = weeks.find(w => w.id === activeWeekId)
  const sessionsForDay = useMemo(
    () => (activeWeek?.sessions || []).filter(s => s.day_offset === activeDay),
    [activeWeek, activeDay]
  )
  const activeSession = sessionsForDay.find(s => s.period === activePeriod) || sessionsForDay[0] || null

  useEffect(() => {
    if (sessionsForDay.length && !sessionsForDay.some(s => s.period === activePeriod)) {
      setActivePeriod(sessionsForDay[0].period)
    }
  }, [sessionsForDay, activePeriod])

  const runAction = async (fn) => {
    setBusy(true)
    setActionError(null)
    try {
      await fn()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading || box.loading) return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>
  if (error) return <div className="errorBox">{error}</div>
  if (!program) return <div className="empty">Programme introuvable.</div>

  return (
    <div className="stack">
      <button className="action" onClick={() => router.push('/dashboard/programme')} style={{ alignSelf: 'flex-start' }}>← Retour</button>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h1 className="h1">{program.name}</h1>
            {athleteName && <p className="muted">Pour {athleteName}</p>}
          </div>
          <span className="badge">{STATUS_LABELS[program.status]}</span>
        </div>
        {canEdit && (
          <div className="action-row" style={{ marginTop: 10 }}>
            {program.status === 'draft' && (
              <button className="action primary" disabled={busy} onClick={() => runAction(() => setStatus('active'))}>
                Publier le programme
              </button>
            )}
            {program.status === 'active' && (
              <button className="action" disabled={busy} onClick={() => runAction(() => setStatus('completed'))}>
                Marquer terminé
              </button>
            )}
            {program.status !== 'archived' && (
              <button className="action" disabled={busy} onClick={() => runAction(() => setStatus('archived'))}>
                Archiver
              </button>
            )}
            {box.isCoach && (
              <button className="action" disabled={busy} onClick={() => setShowDuplicateForm(v => !v)}>
                📋 Dupliquer vers un autre athlète
              </button>
            )}
          </div>
        )}
        {program.status === 'draft' && canEdit && (
          <p className="muted" style={{ marginTop: 6, fontSize: 12 }}>L&apos;athlète sera notifié à la publication.</p>
        )}
        {showDuplicateForm && (
          <DuplicateToAthleteForm
            athletes={athletes.filter(a => a.role === 'member' && a.userId !== program.athlete_id)}
            defaultName={program.name}
            onDuplicate={async ({ athleteId, startDate, name }) => {
              const newProgram = await duplicateToAthlete(athleteId, startDate, name)
              router.push(`/dashboard/programme/${newProgram.id}`)
            }}
            onCancel={() => setShowDuplicateForm(false)}
          />
        )}
        {actionError && <div className="errorBox" style={{ marginTop: 8 }}>{actionError}</div>}
      </div>

      <div className="weekRow">
        {weeks.map(w => (
          <button
            key={w.id}
            className={`action ${activeWeekId === w.id ? 'primary' : ''}`}
            onClick={() => { setActiveWeekId(w.id); setActiveDay(0) }}
          >
            {w.label || `S${w.week_number}`}
          </button>
        ))}
        {canEdit && (
          <>
            <button className="action" disabled={busy} onClick={() => runAction(() => addWeek())}>＋ Ajouter une semaine</button>
            {activeWeek && (
              <WeekMenu
                busy={busy}
                canDelete={weeks.length > 1}
                onDuplicate={() => runAction(async () => {
                  const w = await duplicateWeek(activeWeek.id)
                  setActiveWeekId(w.id)
                })}
                onDelete={() => runAction(async () => {
                  const idx = weeks.findIndex(w => w.id === activeWeek.id)
                  await deleteWeek(activeWeek.id)
                  setActiveWeekId(weeks[idx === 0 ? 1 : idx - 1]?.id || null)
                })}
              />
            )}
          </>
        )}
      </div>

      {activeWeek && (
        <>
          {/* Vue semaine : les 7 jours d'un coup, avec type de séance (icône du
              1er bloc) et nombre de blocs — le coach comprend la semaine sans
              cliquer, plutôt qu'une rangée d'onglets Lun/Mar/Mer. */}
          <div className="dayGrid">
            {DAY_LABELS.map((label, offset) => {
              const daySessions = activeWeek.sessions.filter(s => s.day_offset === offset)
              const dateForDay = daySessions[0]?.session_date
              const totalBlocks = daySessions.reduce((sum, s) => sum + s.blocks.length, 0)
              const isRest = daySessions.length === 0
              const isActive = activeDay === offset
              const icons = daySessions.map(s => getBlockType(s.blocks[0]?.block_type).icon)
              return (
                <button
                  key={offset}
                  type="button"
                  className={`dayCard ${isActive ? 'dayCardActive' : ''} ${isRest ? 'dayCardRest' : ''}`}
                  onClick={() => setActiveDay(offset)}
                >
                  <span className="dayCardLabel">{label}{dateForDay ? ` ${new Date(`${dateForDay}T00:00:00`).getDate()}` : ''}</span>
                  {isRest ? (
                    <span className="dayCardRestTxt">{canEdit ? '＋' : '—'}</span>
                  ) : (
                    <>
                      <span className="dayCardIcons">{icons.join(' ')}</span>
                      <span className="dayCardCount">{totalBlocks} bloc{totalBlocks > 1 ? 's' : ''}</span>
                    </>
                  )}
                </button>
              )
            })}
          </div>

          {canEdit && (
            <div className="action-row">
              {['AM', 'PM'].map(period => {
                const exists = sessionsForDay.some(s => s.period === period)
                if (exists) return null
                return (
                  <button key={period} className="action" disabled={busy} onClick={() => runAction(async () => {
                    const s = await addSession(activeWeek.id, activeDay, period)
                    setActivePeriod(s.period)
                  })}>
                    ＋ Ajouter une séance ({PERIOD_LABELS[period]})
                  </button>
                )
              })}
            </div>
          )}

          {sessionsForDay.length > 1 && (
            <div className="action-row">
              {sessionsForDay.map(s => (
                <button key={s.id} className={`action ${activePeriod === s.period ? 'primary' : ''}`} onClick={() => setActivePeriod(s.period)}>
                  {PERIOD_LABELS[s.period]}
                </button>
              ))}
            </div>
          )}

          {activeSession ? (
            <div className="stack" style={{ gap: 8 }}>
              <p className="muted mono">{formatSessionDateLabel(activeSession.session_date)}</p>
              {activeSession.blocks.map((block, i) => (
                <ProgramBlockCard
                  key={block.id}
                  block={block}
                  letter={String.fromCharCode(65 + i)}
                  canEdit={canEdit}
                  isAthleteView={isAthleteView}
                  userId={userId}
                  athleteId={program.athlete_id}
                  boxId={program.box_id}
                  onUpdateBlock={(blockId, patch) => updateBlock(activeWeek.id, activeSession.id, blockId, patch)}
                  onDeleteBlock={blockId => runAction(() => deleteBlock(activeWeek.id, activeSession.id, blockId))}
                  onUpsertLog={(blockId, patch) => upsertMyLog(activeWeek.id, activeSession.id, blockId, patch)}
                />
              ))}
              {canEdit && (
                <>
                  <AddBlockForm
                    catalog={catalog}
                    onAddBlock={payload => addBlock(activeWeek.id, activeSession.id, payload)}
                    onCreateExercise={name => createPersonalExercise(userId, name, defaultMuscleGroup())}
                  />
                  {activeSession.blocks.length === 0 && (
                    <button className="action" disabled={busy} onClick={() => runAction(() => deleteSession(activeWeek.id, activeSession.id))}>
                      Supprimer cette séance vide
                    </button>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="card empty">Aucune séance ce jour.</div>
          )}
        </>
      )}
    </div>
  )
}
