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
import BottomSheet from '../../../../components/program/BottomSheet'
import WeekDaySelector from '../../../../components/program/WeekDaySelector'
import WeekOverview from '../../../../components/program/WeekOverview'
import BlockReorderList from '../../../../components/program/BlockReorderList'
import WeekBoard from '../../../../components/program/WeekBoard'
import DayFeeling from '../../../../components/program/DayFeeling'
import { useProgramFeelings } from '../../../../lib/hooks/useProgramFeelings'
import { supabase } from '../../../../lib/supabase'

const STATUS_LABELS = { draft: 'Brouillon', active: 'Actif', completed: 'Terminé', archived: 'Archivé' }
const STATUS_STYLE = {
  draft: { background: 'var(--gold-dim)', color: 'var(--gold)' },
  active: { background: 'var(--rx-dim)', color: 'var(--rx)' },
  completed: { background: 'var(--info-dim)', color: 'var(--info)' },
  archived: { background: 'var(--bg-card-2)', color: 'var(--chalk-muted)' },
}
const PERIOD_SHORT = { AM: 'AM', PM: 'PM', unique: 'Séance' }
const PERIOD_ADD_LABELS = { AM: 'matin', PM: 'soir' }
const DANGER_STYLE = { color: 'var(--danger)', borderColor: 'rgba(255,74,74,0.35)' }

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

// Menu "•••" unique de la page : toutes les actions de gestion (programme +
// semaine) sont regroupées ici pour laisser la place à la séance.
// sections = [{ label, items: [{ key, label, onClick, danger } | false] }]
function ActionsMenu({ sections, busy }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const visible = sections
    .map(s => ({ ...s, items: s.items.filter(Boolean) }))
    .filter(s => s.items.length > 0)
  if (visible.length === 0) return null

  return (
    <div className="kebab" ref={ref}>
      <button type="button" className="kebabBtn" disabled={busy} onClick={() => setOpen(v => !v)} aria-label="Actions">•••</button>
      {open && (
        <div className="kebabPanel" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {visible.map(section => (
            <div key={section.label}>
              <div className="eyebrow" style={{ padding: '8px 10px 2px', fontSize: 10, color: 'var(--chalk-muted)' }}>{section.label}</div>
              {section.items.map(item => (
                <button
                  key={item.key}
                  type="button"
                  className="kebabItem"
                  style={{ border: 'none', width: '100%', ...(item.danger ? { color: 'var(--danger)' } : null) }}
                  onClick={() => { setOpen(false); item.onClick() }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
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
    addBlock, updateBlock, deleteBlock, reorderBlocks, upsertMyLog, setStatus, setShared, duplicateToAthlete,
    renameProgram, deleteProgram,
  } = useProgram(id, userId)
  const { catalog } = useExerciseCatalog(userId)
  const { feelings, saveFeeling } = useProgramFeelings(program?.id, program?.athlete_id)
  const { athletes } = useProgramsList({ userId, boxId: box.activeBoxId, isCoach: box.isCoach })

  // Jour sélectionné (clé YYYY-MM-DD) → semaine + jour du programme.
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
  const [showCalendar, setShowCalendar] = useState(false)
  const [showWeekOverview, setShowWeekOverview] = useState(false)
  const [showAddBlock, setShowAddBlock] = useState(false)
  const [reordering, setReordering] = useState(false) // mode "Réorganiser" les blocs de la séance
  // Grand écran (≥ 1024 px) : la semaine s'affiche en 7 colonnes par défaut ;
  // sur mobile on reste sur la vue "un jour à la fois".
  const [isDesktop, setIsDesktop] = useState(false)
  const [view, setView] = useState('day') // 'day' | 'week' (la vue semaine n'existe que sur grand écran)

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
  // Programme partagé de la box : lecture seule pour les membres, géré par les
  // coachs. Rattaché au coach (athlete_id) mais le programme "perso" de
  // personne : ni suivi athlète ni ressenti dessus.
  const isShared = program?.is_shared === true
  const isAthleteView = program?.athlete_id === userId && !isShared

  const located = program && selectedKey ? locateDate(program.start_date, selectedKey) : null
  const activeWeek = located ? weeks.find(w => w.week_number === located.weekNumber) || null : null
  const activeDay = located?.dayOffset ?? 0
  const weekNumbers = weeks.map(w => w.week_number).sort((a, b) => a - b)
  const maxWeekNumber = weekNumbers[weekNumbers.length - 1] || 0
  const currentWeekNumber = located?.weekNumber ?? 0
  const prevWeekNumber = [...weekNumbers].reverse().find(n => n < currentWeekNumber) ?? null
  const nextWeekNumber = weekNumbers.find(n => n > currentWeekNumber) ?? null

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

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const apply = () => setIsDesktop(mq.matches)
    apply()
    setView(mq.matches ? 'week' : 'day')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  // Le mode Réorganiser ne suit pas quand on change de jour / de séance.
  useEffect(() => { setReordering(false) }, [activeSession?.id])

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

  // ‹ › : même jour de la semaine, semaine existante précédente / suivante.
  const goWeek = (delta) => {
    const target = delta > 0 ? nextWeekNumber : prevWeekNumber
    if (target == null) return
    setSelectedKey(computeSessionDate(program.start_date, target, located?.dayOffset ?? 0))
  }

  const addSessionFor = (period) => runAction(async () => {
    const s = await addSession(activeWeek.id, activeDay, period)
    setActivePeriod(s.period)
  })

  if (loading || box.loading) return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>
  if (error) return <div className="errorBox">{error}</div>
  if (!program) return <div className="empty">Programme introuvable.</div>

  const todayKey = localDateKey()
  // Vue semaine en colonnes : coach uniquement (les adhérents gardent la vue jour).
  const showBoard = box.isCoach && isDesktop && view === 'week' && !!located && !!activeWeek
  const dayMode = !showBoard
  const dateHeading = selectedKey
    ? capitalize(new Date(`${selectedKey}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))
    : ''
  const blocksCount = activeSession?.blocks.length || 0
  const dayTag = activeSession
    ? `${selectedKey === todayKey ? "Séance du jour · " : ''}${blocksCount} bloc${blocksCount > 1 ? 's' : ''}`
    : (located && activeWeek ? 'Jour de repos' : '')

  // Sous-titre de la barre semaine : libellé de la semaine, sinon ses dates.
  let weekSub = ''
  if (located) {
    if (activeWeek?.label) weekSub = activeWeek.label
    else {
      const first = new Date(`${computeSessionDate(program.start_date, located.weekNumber, 0)}T00:00:00`)
      const last = new Date(`${computeSessionDate(program.start_date, located.weekNumber, 6)}T00:00:00`)
      weekSub = `${first.getDate()} – ${last.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
    }
  }

  const missingPeriods = ['AM', 'PM'].filter(p => !sessionsForDay.some(s => s.period === p))

  const menuSections = canEdit ? [
    {
      label: 'Programme',
      items: [
        canManage && program.status === 'draft' && { key: 'publish', label: '🚀 Publier le programme', onClick: () => runAction(() => setStatus('active')) },
        canManage && program.status === 'active' && { key: 'complete', label: '✅ Marquer terminé', onClick: () => runAction(() => setStatus('completed')) },
        canManage && program.status !== 'archived' && { key: 'archive', label: '📦 Archiver', onClick: () => runAction(() => setStatus('archived')) },
        box.isCoach && !isShared && { key: 'share', label: '🏟 Partager avec toute la box', onClick: () => runAction(() => setShared(true)) },
        box.isCoach && isShared && { key: 'unshare', label: '👤 Rendre individuel (retirer à la box)', onClick: () => runAction(() => setShared(false)) },
        box.isCoach && { key: 'duplicate', label: '📋 Dupliquer vers un autre athlète', onClick: () => setShowDuplicateForm(v => !v) },
        canManage && { key: 'rename', label: '✏️ Renommer le programme', onClick: () => { setNameDraft(program.name); setRenaming(true); setConfirmDelete(false) } },
        canManage && { key: 'delete', label: '🗑 Supprimer le programme', danger: true, onClick: () => { setConfirmDelete(true); setRenaming(false) } },
      ],
    },
    {
      label: 'Semaine',
      items: [
        { key: 'addWeek', label: '＋ Ajouter une semaine', onClick: () => runAction(async () => { const w = await addWeek(); selectWeekStart(w) }) },
        activeWeek && { key: 'renameWeek', label: '✏️ Renommer cette semaine', onClick: () => setEditingWeek({ id: activeWeek.id, value: activeWeek.label || '' }) },
        activeWeek && { key: 'dupWeek', label: '📋 Dupliquer cette semaine', onClick: () => runAction(async () => { const w = await duplicateWeek(activeWeek.id); selectWeekStart(w) }) },
        activeWeek && weeks.length > 1 && {
          key: 'delWeek', label: '🗑 Supprimer cette semaine', danger: true,
          onClick: () => runAction(async () => {
            const idx = weeks.findIndex(w => w.id === activeWeek.id)
            const neighbour = weeks[idx === 0 ? 1 : idx - 1]
            await deleteWeek(activeWeek.id)
            if (neighbour) selectWeekStart(neighbour)
          }),
        },
      ],
    },
  ] : []

  return (
    <div className="stack">
      {/* 1. Barre du haut : retour + menu d'actions */}
      <div className="pgTop">
        <button type="button" className="pgBack" onClick={() => router.push('/dashboard/programme')}>← Programmes</button>
        <ActionsMenu sections={menuSections} busy={busy} />
      </div>

      {/* 2. En-tête compact : nom · athlète · statut */}
      <section className="pgHeader">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow" style={{ color: 'var(--chalk-muted)' }}>Programme d&apos;entraînement</div>
          {renaming ? (
            <div style={{ marginTop: 6 }}>
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
            </div>
          ) : (
            <h1 className="h1" style={{ margin: '4px 0 3px' }}>{program.name}</h1>
          )}
          <div className="muted" style={{ fontSize: 12 }}>
            {isShared ? 'Programme de la box · ' : athleteName ? `Pour ${athleteName} · ` : ''}{weeks.length} semaine{weeks.length > 1 ? 's' : ''}
          </div>
        </div>
        <span className="badge" style={{ ...STATUS_STYLE[program.status], whiteSpace: 'nowrap' }}>● {STATUS_LABELS[program.status]}</span>
      </section>

      {program.status === 'draft' && canManage && (
        <div className="pgDraft">
          <span className="muted" style={{ fontSize: 12 }}>
            {isShared ? 'Les membres de la box le verront une fois publié.' : 'L\u2019athlète sera notifié à la publication.'}
          </span>
          <button className="action primary" disabled={busy} onClick={() => runAction(() => setStatus('active'))}>Publier</button>
        </div>
      )}

      {confirmDelete && canManage && (
        <div className="card">
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

      {showDuplicateForm && (
        <div className="card">
          <DuplicateToAthleteForm
            athletes={athletes.filter(a => a.role === 'member' && a.userId !== program.athlete_id)}
            defaultName={program.name}
            onDuplicate={async ({ athleteId, startDate, name }) => {
              const newProgram = await duplicateToAthlete(athleteId, startDate, name)
              router.push(`/dashboard/programme/${newProgram.id}`)
            }}
            onCancel={() => setShowDuplicateForm(false)}
          />
        </div>
      )}

      {actionError && <div className="errorBox">{actionError}</div>}

      {/* 3. Navigation semaine compacte : ‹ Semaine 3 / 6 · Calendrier › */}
      <section className="pgWeekNav">
        <button type="button" className="pgNavBtn" disabled={prevWeekNumber == null} onClick={() => goWeek(-1)} aria-label="Semaine précédente">‹</button>
        <div className="pgWeekMain">
          <div className="pgWeekName">
            Semaine {located ? located.weekNumber : '—'} <span className="pgWeekMeta">/ {maxWeekNumber}</span>
          </div>
          <div className="pgWeekMeta pgEllipsis">{weekSub}</div>
        </div>
        {box.isCoach && (
          <div className="pgPeriods pgViewToggle" role="group" aria-label="Affichage">
            <button type="button" className={view === 'day' ? 'pgPeriodActive' : ''} onClick={() => setView('day')}>Jour</button>
            <button type="button" className={view === 'week' ? 'pgPeriodActive' : ''} onClick={() => setView('week')}>Semaine</button>
          </div>
        )}
        <button type="button" className="pgCalBtn" onClick={() => setShowCalendar(true)}>▦ Calendrier</button>
        <button type="button" className="pgNavBtn" disabled={nextWeekNumber == null} onClick={() => goWeek(1)} aria-label="Semaine suivante">›</button>
      </section>

      {editingWeek && (
        <div className="card">
          <label className="label">Nom de la semaine</label>
          <input
            className="input"
            value={editingWeek.value}
            placeholder={`Semaine ${located?.weekNumber ?? ''}`}
            onChange={e => setEditingWeek({ ...editingWeek, value: e.target.value })}
            onKeyDown={e => {
              if (e.key === 'Enter' && !busy) runAction(async () => { await renameWeek(editingWeek.id, editingWeek.value); setEditingWeek(null) })
            }}
            autoFocus
          />
          <div className="action-row" style={{ marginTop: 8 }}>
            <button className="action" disabled={busy} onClick={() => setEditingWeek(null)}>Annuler</button>
            <button className="action primary" disabled={busy} onClick={() => runAction(async () => { await renameWeek(editingWeek.id, editingWeek.value); setEditingWeek(null) })}>
              Enregistrer
            </button>
          </div>
        </div>
      )}

      {/* Vue semaine en colonnes (grand écran) */}
      {showBoard && (
        <>
          <div className="wideBoard" />
          <WeekBoard
            startDate={program.start_date}
            weekNumber={located.weekNumber}
            week={activeWeek}
            athleteId={program.athlete_id}
            selectedKey={selectedKey}
            todayKey={todayKey}
            feelings={feelings}
            onPick={key => { setSelectedKey(key); setView('day') }}
          />
        </>
      )}

      {/* 4. Les 7 jours sur une ligne */}
      {dayMode && located && (
        <WeekDaySelector
          startDate={program.start_date}
          weekNumber={located.weekNumber}
          week={activeWeek}
          athleteId={program.athlete_id}
          selectedKey={selectedKey}
          todayKey={todayKey}
          onSelect={setSelectedKey}
        />
      )}

      {/* 5. En-tête de séance : date · AM / PM */}
      {dayMode && selectedKey && (
        <section className="pgSessionHead">
          <div style={{ minWidth: 0 }}>
            <div className="pgDate">{dateHeading}</div>
            {dayTag && <div className="pgDayTag">{dayTag}</div>}
          </div>
          {activeWeek && sessionsForDay.length > 0 && (
            <div className="pgPeriods">
              {sessionsForDay.map(s => (
                <button
                  key={s.id}
                  type="button"
                  className={activePeriod === s.period ? 'pgPeriodActive' : ''}
                  onClick={() => setActivePeriod(s.period)}
                >
                  {PERIOD_SHORT[s.period] || s.period}
                </button>
              ))}
              {canEdit && missingPeriods.map(p => (
                <button key={p} type="button" className="pgPeriodAdd" disabled={busy} onClick={() => addSessionFor(p)}>
                  ＋ {PERIOD_SHORT[p]}
                </button>
              ))}
            </div>
          )}
        </section>
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

      {/* 6. Contenu de la séance : les blocs A, B, C… (cartes inchangées) */}
      {dayMode && activeWeek && (
        activeSession ? (
          <div className="stack" style={{ gap: 9 }}>
            {canEdit && activeSession.blocks.length > 1 && (
              <div className="pgReorderBar">
                {reordering ? (
                  <button type="button" className="action primary" onClick={() => setReordering(false)}>✓ Terminé</button>
                ) : (
                  <button type="button" className="action" onClick={() => setReordering(true)}>↕ Réorganiser</button>
                )}
              </div>
            )}
            {reordering && canEdit ? (
              <BlockReorderList
                blocks={activeSession.blocks}
                onReorder={ids => reorderBlocks(activeWeek.id, activeSession.id, ids)}
              />
            ) : activeSession.blocks.map((block, i) => (
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
            {!reordering && !isShared && activeSession.blocks.length > 0 && ((box.isCoach && !isAthleteView) || (isAthleteView && selectedKey <= todayKey)) && (
              <DayFeeling
                key={selectedKey}
                feeling={feelings[selectedKey]}
                canWrite={isAthleteView}
                athleteName={athleteName}
                onSave={(rating, comment) => saveFeeling(selectedKey, rating, comment)}
              />
            )}
            {activeSession.blocks.length === 0 && (
              <div className="card empty">
                {canEdit ? 'Séance vide. Utilise « Ajouter un bloc » en bas de l’écran.' : 'Cette séance est vide pour le moment.'}
              </div>
            )}
            {canEdit && activeSession.blocks.length === 0 && (
              <button className="action" disabled={busy} onClick={() => runAction(() => deleteSession(activeWeek.id, activeSession.id))}>
                Supprimer cette séance vide
              </button>
            )}
          </div>
        ) : (
          <div className="card empty">
            <p className="muted">{canEdit ? 'Jour de repos.' : 'Aucune séance ce jour.'}</p>
            {canEdit && (
              <div className="action-row" style={{ justifyContent: 'center', marginTop: 10 }}>
                {['AM', 'PM'].map(p => (
                  <button key={p} className="action" disabled={busy} onClick={() => addSessionFor(p)}>
                    ＋ Séance {PERIOD_ADD_LABELS[p]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      )}

      {/* 7. Barre d'action fixe en bas */}
      {dayMode && activeWeek && (
        <div className={`pgFooter ${box.isCoach ? 'pgFooterCoach' : ''}`}>
          <button type="button" className="pgSecondary" onClick={() => setShowWeekOverview(true)}>Vue semaine</button>
          {canEdit && activeSession && (
            <button type="button" className="pgPrimary" onClick={() => setShowAddBlock(true)}>＋ Ajouter un bloc</button>
          )}
          {canEdit && !activeSession && (
            <button type="button" className="pgPrimary" disabled={busy} onClick={() => addSessionFor('AM')}>＋ Ajouter une séance</button>
          )}
        </div>
      )}

      <BottomSheet open={showCalendar} onClose={() => setShowCalendar(false)} title="Calendrier" subtitle="Saute directement à une date.">
        {showCalendar && (
          <ProgramCalendar
            bare
            startDate={program.start_date}
            weeks={weeks}
            athleteId={program.athlete_id}
            selectedKey={selectedKey}
            onSelect={key => { setSelectedKey(key); setShowCalendar(false) }}
          />
        )}
      </BottomSheet>

      <BottomSheet
        open={showWeekOverview}
        onClose={() => setShowWeekOverview(false)}
        title={`Semaine ${located?.weekNumber ?? ''}`}
        subtitle={weekSub}
      >
        {showWeekOverview && located && (
          <WeekOverview
            startDate={program.start_date}
            weekNumber={located.weekNumber}
            week={activeWeek}
            athleteId={program.athlete_id}
            selectedKey={selectedKey}
            todayKey={todayKey}
            onPick={key => { setSelectedKey(key); setShowWeekOverview(false) }}
          />
        )}
      </BottomSheet>

      <BottomSheet open={showAddBlock} onClose={() => setShowAddBlock(false)} title="Ajouter un bloc" subtitle={dateHeading}>
        {showAddBlock && activeWeek && activeSession && (
          <AddBlockForm
            defaultOpen
            catalog={catalog}
            onAddBlock={payload => addBlock(activeWeek.id, activeSession.id, payload)}
            onCreateExercise={name => createPersonalExercise(userId, name, defaultMuscleGroup())}
            onClose={() => setShowAddBlock(false)}
          />
        )}
      </BottomSheet>

      <style jsx>{`
        .pgTop { display: flex; align-items: center; justify-content: space-between; }
        .pgBack { padding: 6px 0; background: none; border: 0; color: var(--chalk-dim); font: inherit; font-size: 14px; cursor: pointer; }
        .pgHeader { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
        .pgDraft {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          padding: 8px 8px 8px 12px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg-card);
        }

        .pgWeekNav {
          display: flex; align-items: center; gap: 6px; padding: 8px 8px;
          background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px;
        }
        .pgNavBtn { flex: none; width: 34px; height: 36px; border: 0; background: transparent; color: var(--chalk); font-size: 22px; cursor: pointer; }
        .pgNavBtn:disabled { opacity: .25; cursor: default; }
        .pgWeekMain { flex: 1; min-width: 0; padding-left: 4px; }
        .pgWeekName { font-weight: 700; font-size: 14px; }
        .pgWeekMeta { font-size: 11px; font-weight: 400; color: var(--chalk-muted); }
        .pgEllipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pgCalBtn {
          flex: none; padding: 7px 9px; border-radius: 9px; border: 1px solid var(--accent-brd);
          background: var(--accent-dim); color: var(--accent); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer;
        }

        .pgSessionHead { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
        .pgDate { font-size: 17px; font-weight: 700; }
        .pgDayTag { margin-top: 1px; font-size: 11px; color: var(--chalk-muted); }
        .pgPeriods { display: flex; gap: 3px; padding: 3px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; }
        .pgPeriods button {
          padding: 6px 12px; border: 0; border-radius: 7px; background: transparent;
          color: var(--chalk-dim); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer;
        }
        .pgPeriods button.pgPeriodActive { background: var(--accent); color: #16110D; }
        .pgPeriods button.pgPeriodAdd { color: var(--chalk-muted); border: 1px dashed var(--border-hi); }
        .pgPeriods button:disabled { opacity: .5; cursor: default; }

        .pgReorderBar { display: flex; justify-content: flex-end; }
        .pgViewToggle { display: none; }
        @media (min-width: 1024px) {
          .pgViewToggle { display: flex; }
          .pgFooter.pgFooterCoach { bottom: 0; } /* barre du bas masquée = coach sur grand écran */
        }

        .pgFooter {
          position: sticky; bottom: var(--mnav-h); z-index: 10; display: flex; gap: 8px;
          margin: 0 -16px; padding: 14px 16px 10px;
          background: linear-gradient(180deg, rgba(18,19,22,0), var(--bg) 40%);
        }
        .pgPrimary {
          flex: 1; padding: 12px; border: 0; border-radius: 11px; background: var(--accent); color: #16110D;
          font: inherit; font-weight: 800; cursor: pointer;
        }
        .pgPrimary:disabled { opacity: .5; cursor: default; }
        .pgSecondary {
          padding: 12px 16px; border-radius: 11px; border: 1px solid var(--border-hi); background: var(--bg-card);
          color: var(--chalk); font: inherit; font-weight: 700; cursor: pointer;
        }
        .pgSecondary:only-child { flex: 1; }
      `}</style>
    </div>
  )
}
