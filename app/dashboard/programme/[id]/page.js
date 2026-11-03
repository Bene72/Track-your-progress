'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useCurrentUser } from '../../../../lib/hooks/useCurrentUser'
import { useBox } from '../../../../lib/hooks/useBox'
import { useProgram, useExerciseCatalog, createPersonalExercise, useProgramsList } from '../../../../lib/hooks/usePrograms'
import { locateDate, computeSessionDate } from '../../../../lib/program-date'
import { localDateKey } from '../../../../lib/date'
import { defaultMuscleGroup } from '../../../../components/personal-session/helpers'
import ProgramBlockCard from '../../../../components/program/ProgramBlockCard'
import ProgramCalendar from '../../../../components/program/ProgramCalendar'
import AddBlockForm from '../../../../components/program/AddBlockForm'
import DuplicateToAthleteForm from '../../../../components/program/DuplicateToAthleteForm'
import { supabase } from '../../../../lib/supabase'

const STATUS_LABELS = { draft: 'Brouillon', active: 'Actif', completed: 'Terminé', archived: 'Archivé' }
const PERIOD_LABELS = { AM: 'Matin', PM: 'Soir', unique: 'Séance' }
const DANGER_STYLE = { color: 'var(--danger)', borderColor: 'rgba(255,74,74,0.35)' }

// Menu "•••" pour les actions sur la semaine sélectionnée
// (Renommer / Dupliquer / Supprimer).
function WeekMenu({ onRename, onDuplicate, onDelete, canDelete, busy }) {
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
          <button type="button" className="kebabItem" onClick={() => { setOpen(false); onRename() }}>✏️ Renommer cette semaine</button>
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
    addWeek, duplicateWeek, deleteWeek, renameWeek, addSession, deleteSession,
    addBlock, updateBlock, deleteBlock, upsertMyLog, setStatus, duplicateToAthlete,
    renameProgram, deleteProgram,
  } = useProgram(id, userId)
  const { catalog } = useExerciseCatalog(userId)
  const { athletes } = useProgramsList({ userId, boxId: box.activeBoxId, isCoach: box.isCoach })

  // Jour sélectionné dans le calendrier (clé YYYY-MM-DD) → semaine + jour du
  // programme. La navigation par date remplace les anciens onglets de semaines.
  const [selectedKey, setSelectedKey] = useState(null)
  const [activePeriod, setActivePeriod] = useState('AM')
  const [athleteName, setAthleteName] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [showDuplicateForm, setShowDuplicateForm] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editingWeek, setEditingWeek] = useState(null) // { id, value } | null

  // À l'ouverture : aujourd'hui si le programme est en cours, sinon son 1er jour.
  useEffect(() => {
    if (loading || !program || selectedKey) return
    const today = localDateKey()
    const loc = locateDate(program.start_date, today)
    const inProgram = loc && weeks.some(w => w.week_number === loc.weekNumber)
    setSelectedKey(inProgram ? today : program.start_date)
  }, [loading, program, weeks, selectedKey])

  useEffect(() => {
    async function loadAthlete() {
      if (!program?.athlete_id) return
      const { data } = await supabase.from('profiles').select('full_name').eq('id', program.athlete_id).maybeSingle()
      setAthleteName(data?.full_name || '')
    }
    loadAthlete()
  }, [program?.athlete_id])

  const canEdit = program ? canEditStructure(userId, box.isCoach) : false
  // Renommer / supprimer : mêmes droits que la RLS de la table programs
  // (coach de la box ou créateur du programme).
  const canManage = program ? (box.isCoach || program.created_by === userId) : false
  const isAthleteView = program?.athlete_id === userId

  const located = program && selectedKey ? locateDate(program.start_date, selectedKey) : null
  const activeWeek = located ? weeks.find(w => w.week_number === located.weekNumber) || null : null
  const activeDay = located?.dayOffset ?? 0
  const maxWeekNumber = weeks.reduce((m, w) => Math.max(m, w.week_number), 0)

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

  const selectWeekStart = (week) => setSelectedKey(computeSessionDate(program.start_date, week.week_number, 0))

  if (loading || box.loading) return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>
  if (error) return <div className="errorBox">{error}</div>
  if (!program) return <div className="empty">Programme introuvable.</div>

  const dateHeading = selectedKey
    ? new Date(`${selectedKey}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })
    : ''

  return (
    <div className="stack">
      <button className="action" onClick={() => router.push('/dashboard/programme')} style={{ alignSelf: 'flex-start' }}>← Retour</button>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {renaming ? (
              <>
                <label className="label">Nom du programme</label>
                <input
                  className="input"
                  value={nameDraft}
                  onChange={e => setNameDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !busy) runAction(async () => { await renameProgram(nameDraft); setRenaming(false) })
                  }}
                  autoFocus
                />
                <div className="action-row" style={{ marginTop: 8 }}>
                  <button className="action" disabled={busy} onClick={() => setRenaming(false)}>Annuler</button>
                  <button className="action primary" disabled={busy} onClick={() => runAction(async () => { await renameProgram(nameDraft); setRenaming(false) })}>
                    Enregistrer
                  </button>
                </div>
              </>
            ) : (
              <h1 className="h1">{program.name}</h1>
            )}
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
            {canManage && !renaming && (
              <button className="action" disabled={busy} onClick={() => { setNameDraft(program.name); setRenaming(true); setConfirmDelete(false) }}>
                ✏️ Renommer
              </button>
            )}
            {canManage && (
              <button className="action" style={DANGER_STYLE} disabled={busy} onClick={() => { setConfirmDelete(v => !v); setRenaming(false) }}>
                🗑 Supprimer
              </button>
            )}
          </div>
        )}
        {confirmDelete && canManage && (
          <div style={{ marginTop: 10 }}>
            <p className="muted" style={{ fontSize: 13 }}>
              Supprimer « {program.name} » ? Les semaines, séances et blocs seront définitivement effacés.
            </p>
            <div className="action-row" style={{ marginTop: 8 }}>
              <button className="action" disabled={busy} onClick={() => setConfirmDelete(false)}>Annuler</button>
              <button
                className="action"
                style={DANGER_STYLE}
                disabled={busy}
                onClick={() => runAction(async () => {
                  await deleteProgram()
                  router.push('/dashboard/programme')
                })}
              >
                Supprimer définitivement
              </button>
            </div>
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

      <ProgramCalendar
        startDate={program.start_date}
        weeks={weeks}
        athleteId={program.athlete_id}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
      />

      {/* Barre de la semaine contenant le jour sélectionné */}
      <div className="row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {editingWeek ? (
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <input
                className="input"
                style={{ flex: 1, minWidth: 160 }}
                value={editingWeek.value}
                placeholder={`Semaine ${activeWeek?.week_number ?? ''}`}
                onChange={e => setEditingWeek({ ...editingWeek, value: e.target.value })}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !busy) runAction(async () => { await renameWeek(editingWeek.id, editingWeek.value); setEditingWeek(null) })
                }}
                autoFocus
              />
              <button className="action" disabled={busy} onClick={() => setEditingWeek(null)}>Annuler</button>
              <button className="action primary" disabled={busy} onClick={() => runAction(async () => { await renameWeek(editingWeek.id, editingWeek.value); setEditingWeek(null) })}>
                OK
              </button>
            </div>
          ) : (
            <span className="eyebrow">
              {activeWeek ? (activeWeek.label || `Semaine ${activeWeek.week_number}`) : located ? `Semaine ${located.weekNumber}` : 'Avant le programme'}
            </span>
          )}
        </div>
        {canEdit && !editingWeek && (
          <div className="weekRow">
            <button className="action" disabled={busy} onClick={() => runAction(async () => {
              const w = await addWeek()
              selectWeekStart(w)
            })}>＋ Ajouter une semaine</button>
            {activeWeek && (
              <WeekMenu
                busy={busy}
                canDelete={weeks.length > 1}
                onRename={() => setEditingWeek({ id: activeWeek.id, value: activeWeek.label || '' })}
                onDuplicate={() => runAction(async () => {
                  const w = await duplicateWeek(activeWeek.id)
                  selectWeekStart(w)
                })}
                onDelete={() => runAction(async () => {
                  const idx = weeks.findIndex(w => w.id === activeWeek.id)
                  const neighbour = weeks[idx === 0 ? 1 : idx - 1]
                  await deleteWeek(activeWeek.id)
                  if (neighbour) selectWeekStart(neighbour)
                })}
              />
            )}
          </div>
        )}
      </div>

      {/* Jour sélectionné */}
      {selectedKey && (
        <h3 className="eyebrow" style={{ textTransform: 'capitalize' }}>{dateHeading}</h3>
      )}

      {!located && selectedKey && (
        <div className="card empty">
          Ce jour est avant le début du programme ({new Date(`${program.start_date}T00:00:00`).toLocaleDateString('fr-FR')}).
        </div>
      )}

      {located && !activeWeek && (
        <div className="card empty">
          {canEdit && located.weekNumber === maxWeekNumber + 1 ? (
            <>
              <p className="muted" style={{ marginBottom: 10 }}>La semaine {located.weekNumber} n&apos;existe pas encore.</p>
              <button className="action primary" disabled={busy} onClick={() => runAction(async () => {
                const w = await addWeek()
                selectWeekStart(w)
              })}>
                ＋ Ajouter la semaine {located.weekNumber}
              </button>
            </>
          ) : (
            <p className="muted">Ce jour est en dehors des semaines du programme.</p>
          )}
        </div>
      )}

      {activeWeek && (
        <>
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
            <div className="card empty">
              {canEdit ? 'Jour de repos. Ajoute une séance avec les boutons ci-dessus.' : 'Aucune séance ce jour.'}
            </div>
          )}
        </>
      )}
    </div>
  )
}
