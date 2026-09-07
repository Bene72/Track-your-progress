'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { computeSessionDate } from '../program-date'
import { localDateKey } from '../date'

export async function createPersonalExercise(userId, name, muscleGroup) {
  const { data, error } = await supabase
    .from('personal_exercises')
    .insert({ owner_id: userId, name, muscle_group: muscleGroup, is_default: false })
    .select('id, name, muscle_group, video_url')
    .single()
  if (error) throw error
  return data
}

// Catalogue léger (défauts partagés + exercices perso de l'utilisateur),
// utilisé par le formulaire "Ajouter un bloc" pour lier un mouvement.
export function useExerciseCatalog(userId) {
  const [catalog, setCatalog] = useState([])

  const load = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('personal_exercises')
      .select('id, name, muscle_group, owner_id, video_url')
      .order('name')
    // La RLS ne renvoie déjà que les exercices par défaut + les miens.
    if (!error) setCatalog(data || [])
  }, [userId])

  useEffect(() => { load() }, [load])

  return { catalog, reload: load }
}

// ─── Vue liste : mes programmes (athlète) + effectif de la box (coach) ───
export function useProgramsList({ userId, boxId, isCoach }) {
  const [myPrograms, setMyPrograms] = useState([])
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchMyPrograms = useCallback(async () => {
    if (!userId) return
    const { data, error: fetchError } = await supabase
      .from('programs')
      .select('id, name, start_date, status, created_by, athlete_id, box_id, created_at')
      .eq('athlete_id', userId)
      .order('created_at', { ascending: false })
    if (fetchError) throw fetchError
    setMyPrograms(data || [])
  }, [userId])

  const fetchAthletes = useCallback(async () => {
    if (!boxId || !isCoach) { setAthletes([]); return }
    // Deux requêtes séparées (comme partout ailleurs dans l'app, cf.
    // app/dashboard/box/page.js) plutôt qu'un embed PostgREST : box_members
    // n'a pas de FK déclarée vers public.profiles (seulement vers
    // auth.users), donc `profiles(...)` dans un .select() casse avec
    // "Could not find a relationship... in the schema cache".
    const { data, error: fetchError } = await supabase
      .from('box_members')
      .select('user_id, role')
      .eq('box_id', boxId)
      .eq('status', 'active')
      .order('role')
    if (fetchError) throw fetchError

    const userIds = [...new Set((data || []).map(m => m.user_id))]
    let byId = {}
    if (userIds.length) {
      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds)
      if (profErr) throw profErr
      byId = Object.fromEntries((profiles || []).map(p => [p.id, p]))
    }

    setAthletes((data || []).map(m => ({
      userId: m.user_id,
      role: m.role,
      name: byId[m.user_id]?.full_name || 'Membre',
    })))
  }, [boxId, isCoach])

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    Promise.all([fetchMyPrograms(), fetchAthletes()])
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [userId, boxId, isCoach, fetchMyPrograms, fetchAthletes])

  // Programmes d'un athlète donné (vue coach quand il clique sur un membre
  // de l'effectif). Requête à la demande, pas de state permanent global.
  const fetchProgramsForAthlete = useCallback(async (athleteId) => {
    const { data, error: fetchError } = await supabase
      .from('programs')
      .select('id, name, start_date, status, created_by, athlete_id, box_id, created_at')
      .eq('athlete_id', athleteId)
      .order('created_at', { ascending: false })
    if (fetchError) throw fetchError
    return data || []
  }, [])

  const createProgram = useCallback(async ({ athleteId, name, startDate }) => {
    const { data: program, error: progErr } = await supabase
      .from('programs')
      .insert({ box_id: boxId, athlete_id: athleteId, created_by: userId, name, start_date: startDate, status: 'draft' })
      .select('id, name, start_date, status, created_by, athlete_id, box_id, created_at')
      .single()
    if (progErr) throw progErr

    // Semaine 1 créée par défaut : on construit toujours au moins une
    // semaine type avant de la dupliquer (décision produit actée).
    const { error: weekErr } = await supabase
      .from('program_weeks')
      .insert({ program_id: program.id, week_number: 1 })
    if (weekErr) throw weekErr

    if (athleteId === userId) setMyPrograms(prev => [program, ...prev])
    return program
  }, [boxId, userId])

  const deleteProgram = useCallback(async (programId) => {
    const { error: deleteError } = await supabase.from('programs').delete().eq('id', programId)
    if (deleteError) throw deleteError
    setMyPrograms(prev => prev.filter(p => p.id !== programId))
  }, [])

  const setProgramStatus = useCallback(async (programId, status) => {
    const { data, error: updateError } = await supabase
      .from('programs').update({ status }).eq('id', programId)
      .select('id, name, start_date, status, created_by, athlete_id, box_id, created_at').single()
    if (updateError) throw updateError
    setMyPrograms(prev => prev.map(p => (p.id === programId ? data : p)))
    return data
  }, [])

  return {
    myPrograms, athletes, loading, error,
    fetchProgramsForAthlete, createProgram, deleteProgram, setProgramStatus,
    reload: () => Promise.all([fetchMyPrograms(), fetchAthletes()]),
  }
}

// ─── Vue détail : un programme (structure complète + logs de l'athlète) ───
export function useProgram(programId, userId) {
  const [program, setProgram] = useState(null)
  const [weeks, setWeeks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!programId) return
    setLoading(true)
    setError(null)
    try {
      const { data: prog, error: progErr } = await supabase
        .from('programs')
        .select('id, name, start_date, status, created_by, athlete_id, box_id, created_at')
        .eq('id', programId)
        .single()
      if (progErr) throw progErr
      setProgram(prog)

      const { data: weekRows, error: weekErr } = await supabase
        .from('program_weeks')
        .select(`
          id, week_number, label,
          sessions:program_sessions(
            id, day_offset, period,
            blocks:program_blocks(
              id, position, title, prescription, notes, video_url, percent_1rm, block_type,
              exercise:personal_exercises(id, name, muscle_group, video_url),
              logs:program_block_logs(id, athlete_id, status, athlete_note, completed_at, updated_at)
            )
          )
        `)
        .eq('program_id', programId)
        .order('week_number')
      if (weekErr) throw weekErr

      const withDates = (weekRows || []).map(w => ({
        ...w,
        sessions: (w.sessions || [])
          .map(s => ({
            ...s,
            session_date: computeSessionDate(prog.start_date, w.week_number, s.day_offset),
            blocks: (s.blocks || [])
              .sort((a, b) => a.position - b.position)
              .map(b => ({ ...b, myLog: (b.logs || []).find(l => l.athlete_id === userId) || null })),
          }))
          .sort((a, b) => a.day_offset - b.day_offset || (a.period > b.period ? 1 : -1)),
      }))
      setWeeks(withDates)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [programId, userId])

  useEffect(() => { load() }, [load])

  const canEditStructure = useCallback((currentUserId, isCoach) => {
    if (!program) return false
    // Le coach (créateur ou non), le créateur, ET l'athlète à qui le
    // programme est assigné peuvent tous modifier la structure — avant,
    // seul le créateur (souvent le coach) le pouvait, ce qui bloquait
    // l'athlète sur un programme qu'on lui avait assigné.
    return isCoach || program.created_by === currentUserId || program.athlete_id === currentUserId
  }, [program])

  const addWeek = useCallback(async (label = null) => {
    const nextNumber = (weeks[weeks.length - 1]?.week_number || 0) + 1
    const { data, error: insertError } = await supabase
      .from('program_weeks')
      .insert({ program_id: programId, week_number: nextNumber, label })
      .select('id, week_number, label')
      .single()
    if (insertError) throw insertError
    setWeeks(prev => [...prev, { ...data, sessions: [] }])
    return data
  }, [programId, weeks])

  // Duplique une semaine (séances + blocs, pas les logs de l'athlète — c'est
  // une nouvelle occurrence, pas encore réalisée) dans une nouvelle semaine
  // ajoutée à la fin. Cœur de la décision produit "semaine type dupliquée".
  const duplicateWeek = useCallback(async (weekId) => {
    const source = weeks.find(w => w.id === weekId)
    if (!source) throw new Error('Semaine introuvable.')
    const nextNumber = (weeks[weeks.length - 1]?.week_number || 0) + 1

    const { data: newWeek, error: weekErr } = await supabase
      .from('program_weeks')
      .insert({ program_id: programId, week_number: nextNumber, label: source.label })
      .select('id, week_number, label')
      .single()
    if (weekErr) throw weekErr

    const newSessions = []
    for (const session of source.sessions) {
      const { data: newSession, error: sessErr } = await supabase
        .from('program_sessions')
        .insert({ program_week_id: newWeek.id, day_offset: session.day_offset, period: session.period })
        .select('id, day_offset, period')
        .single()
      if (sessErr) throw sessErr

      const newBlocks = []
      for (const block of session.blocks) {
        const { data: newBlock, error: blockErr } = await supabase
          .from('program_blocks')
          .insert({
            program_session_id: newSession.id,
            position: block.position,
            title: block.title,
            prescription: block.prescription,
            exercise_id: block.exercise?.id || null,
            video_url: block.video_url,
            notes: block.notes,
            percent_1rm: block.percent_1rm,
          })
          .select('id, position, title, prescription, notes, video_url, percent_1rm, block_type, exercise:personal_exercises(id, name, muscle_group, video_url)')
          .single()
        if (blockErr) throw blockErr
        newBlocks.push({ ...newBlock, logs: [], myLog: null })
      }
      newSessions.push({
        ...newSession,
        session_date: computeSessionDate(program.start_date, newWeek.week_number, newSession.day_offset),
        blocks: newBlocks,
      })
    }

    setWeeks(prev => [...prev, { ...newWeek, sessions: newSessions }])
    return newWeek
  }, [weeks, programId, program])

  const deleteWeek = useCallback(async (weekId) => {
    const { error: deleteError } = await supabase.from('program_weeks').delete().eq('id', weekId)
    if (deleteError) throw deleteError
    setWeeks(prev => prev.filter(w => w.id !== weekId))
  }, [])

  const addSession = useCallback(async (weekId, dayOffset, period) => {
    const { data, error: insertError } = await supabase
      .from('program_sessions')
      .insert({ program_week_id: weekId, day_offset: dayOffset, period })
      .select('id, day_offset, period')
      .single()
    if (insertError) throw insertError
    const week = weeks.find(w => w.id === weekId)
    const newSession = {
      ...data,
      session_date: computeSessionDate(program.start_date, week.week_number, dayOffset),
      blocks: [],
    }
    setWeeks(prev => prev.map(w => (w.id === weekId ? { ...w, sessions: [...w.sessions, newSession] } : w)))
    return newSession
  }, [weeks, program])

  const deleteSession = useCallback(async (weekId, sessionId) => {
    const { error: deleteError } = await supabase.from('program_sessions').delete().eq('id', sessionId)
    if (deleteError) throw deleteError
    setWeeks(prev => prev.map(w => (w.id === weekId ? { ...w, sessions: w.sessions.filter(s => s.id !== sessionId) } : w)))
  }, [])

  const addBlock = useCallback(async (weekId, sessionId, payload) => {
    const week = weeks.find(w => w.id === weekId)
    const session = week?.sessions.find(s => s.id === sessionId)
    const position = session?.blocks.length || 0
    const { data, error: insertError } = await supabase
      .from('program_blocks')
      .insert({
        program_session_id: sessionId,
        position,
        title: payload.title,
        prescription: payload.prescription || null,
        exercise_id: payload.exerciseId || null,
        video_url: payload.videoUrl || null,
        notes: payload.notes || null,
        percent_1rm: payload.percent1rm || null,
        block_type: payload.blockType || 'exercise',
      })
      .select('id, position, title, prescription, notes, video_url, percent_1rm, block_type, exercise:personal_exercises(id, name, muscle_group, video_url)')
      .single()
    if (insertError) throw insertError
    const newBlock = { ...data, logs: [], myLog: null }
    setWeeks(prev => prev.map(w => (w.id !== weekId ? w : {
      ...w,
      sessions: w.sessions.map(s => (s.id === sessionId ? { ...s, blocks: [...s.blocks, newBlock] } : s)),
    })))
    return newBlock
  }, [weeks])

  const updateBlock = useCallback(async (weekId, sessionId, blockId, patch) => {
    const dbPatch = {}
    if ('title' in patch) dbPatch.title = patch.title
    if ('prescription' in patch) dbPatch.prescription = patch.prescription
    if ('notes' in patch) dbPatch.notes = patch.notes
    if ('exerciseId' in patch) dbPatch.exercise_id = patch.exerciseId
    if ('videoUrl' in patch) dbPatch.video_url = patch.videoUrl
    if ('percent1rm' in patch) dbPatch.percent_1rm = patch.percent1rm
    if ('blockType' in patch) dbPatch.block_type = patch.blockType
    const { data, error: updateError } = await supabase
      .from('program_blocks').update(dbPatch).eq('id', blockId)
      .select('id, position, title, prescription, notes, video_url, percent_1rm, block_type, exercise:personal_exercises(id, name, muscle_group, video_url)')
      .single()
    if (updateError) throw updateError
    setWeeks(prev => prev.map(w => (w.id !== weekId ? w : {
      ...w,
      sessions: w.sessions.map(s => (s.id !== sessionId ? s : {
        ...s,
        blocks: s.blocks.map(b => (b.id === blockId ? { ...data, logs: b.logs, myLog: b.myLog } : b)),
      })),
    })))
    return data
  }, [])

  const deleteBlock = useCallback(async (weekId, sessionId, blockId) => {
    const { error: deleteError } = await supabase.from('program_blocks').delete().eq('id', blockId)
    if (deleteError) throw deleteError
    setWeeks(prev => prev.map(w => (w.id !== weekId ? w : {
      ...w,
      sessions: w.sessions.map(s => (s.id !== sessionId ? s : { ...s, blocks: s.blocks.filter(b => b.id !== blockId) })),
    })))
  }, [])

  // Réponse de l'athlète à un bloc : fait/pas fait + note pour le coach.
  const upsertMyLog = useCallback(async (weekId, sessionId, blockId, patch) => {
    const payload = {
      block_id: blockId,
      athlete_id: userId,
      updated_at: new Date().toISOString(),
      ...patch,
    }
    if (patch.status === 'done' && !payload.completed_at) payload.completed_at = new Date().toISOString()
    const { data, error: upsertError } = await supabase
      .from('program_block_logs')
      .upsert(payload, { onConflict: 'block_id,athlete_id' })
      .select('id, athlete_id, status, athlete_note, completed_at, updated_at')
      .single()
    if (upsertError) throw upsertError
    setWeeks(prev => prev.map(w => (w.id !== weekId ? w : {
      ...w,
      sessions: w.sessions.map(s => (s.id !== sessionId ? s : {
        ...s,
        blocks: s.blocks.map(b => (b.id === blockId ? { ...b, myLog: data } : b)),
      })),
    })))
    return data
  }, [userId])

  const setStatus = useCallback(async (status) => {
    const { data, error: updateError } = await supabase
      .from('programs').update({ status }).eq('id', programId)
      .select('id, name, start_date, status, created_by, athlete_id, box_id, created_at').single()
    if (updateError) throw updateError
    setProgram(data)
    return data
  }, [programId])

  // Duplique tout le programme (semaines/séances/blocs, jamais les logs
  // d'un athlète pour un autre) vers un autre athlète de la même box, comme
  // nouveau programme en brouillon. Le coach le relit/l'ajuste avant de le
  // publier (cf. setStatus).
  const duplicateToAthlete = useCallback(async (targetAthleteId, targetStartDate, name) => {
    if (!program) throw new Error('Programme introuvable.')
    const { data: newProgram, error: progErr } = await supabase
      .from('programs')
      .insert({
        box_id: program.box_id,
        athlete_id: targetAthleteId,
        created_by: userId,
        name: name || program.name,
        start_date: targetStartDate,
        status: 'draft',
      })
      .select('id, name, start_date, status, created_by, athlete_id, box_id, created_at')
      .single()
    if (progErr) throw progErr

    for (const week of weeks) {
      const { data: newWeek, error: weekErr } = await supabase
        .from('program_weeks')
        .insert({ program_id: newProgram.id, week_number: week.week_number, label: week.label })
        .select('id')
        .single()
      if (weekErr) throw weekErr

      for (const session of week.sessions) {
        const { data: newSession, error: sessErr } = await supabase
          .from('program_sessions')
          .insert({ program_week_id: newWeek.id, day_offset: session.day_offset, period: session.period })
          .select('id')
          .single()
        if (sessErr) throw sessErr

        if (session.blocks.length) {
          const rows = session.blocks.map(b => ({
            program_session_id: newSession.id,
            position: b.position,
            title: b.title,
            prescription: b.prescription,
            exercise_id: b.exercise?.id || null,
            video_url: b.video_url,
            notes: b.notes,
            percent_1rm: b.percent_1rm,
          }))
          const { error: blocksErr } = await supabase.from('program_blocks').insert(rows)
          if (blocksErr) throw blocksErr
        }
      }
    }

    return newProgram
  }, [program, weeks, userId])

  return {
    program, weeks, loading, error, canEditStructure,
    addWeek, duplicateWeek, deleteWeek,
    addSession, deleteSession,
    addBlock, updateBlock, deleteBlock,
    upsertMyLog, setStatus, duplicateToAthlete,
    reload: load,
  }
}

// Dernier 1RM connu (PR de type poids) d'un utilisateur sur un mouvement,
// par correspondance de nom (personal_records n'a pas de FK vers
// personal_exercises, juste un texte "movement" libre). Utilisé par
// AutoLoadPanel pour calculer une charge à partir d'un %1RM prescrit.
export function useAthlete1RM(athleteId, exerciseName) {
  const [oneRM, setOneRM] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!athleteId || !exerciseName) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('personal_records_latest')
      .select('value_number, achieved_at')
      .eq('user_id', athleteId)
      .eq('value_type', 'weight')
      .ilike('movement', exerciseName)
      .maybeSingle()
    setOneRM(data || null)
    setLoading(false)
  }, [athleteId, exerciseName])

  useEffect(() => { load() }, [load])

  // Enregistre un nouveau 1RM comme PR (mêmes règles que la page Mes PR).
  // La RLS n'autorise cette écriture que si athleteId === l'utilisateur
  // courant (un coach ne peut pas écrire un PR à la place de l'athlète) ;
  // l'UI ne propose de toute façon ce bouton qu'à l'athlète lui-même.
  const updateOneRM = useCallback(async (newValue) => {
    const { data, error } = await supabase
      .from('personal_records')
      .insert({ user_id: athleteId, movement: exerciseName, value_type: 'weight', value_number: newValue })
      .select('value_number, achieved_at')
      .single()
    if (error) throw error
    setOneRM(data)
    return data
  }, [athleteId, exerciseName])

  return { oneRM, loading, updateOneRM, reload: load }
}

// ─── Tableau de bord coach : taux de complétion par athlète ───────
// Pour chaque programme actif de la box, compte les blocs dont la date est
// passée ou aujourd'hui et le nombre marqués "fait" par l'athlète concerné.
// Volontairement calculé côté client (petit nombre de programmes actifs par
// box) plutôt qu'une vue SQL, pour rester simple à ajuster en V3.
export function useCoachDashboard(boxId, isCoach) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!boxId || !isCoach) { setRows([]); setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const { data: programs, error: progErr } = await supabase
        .from('programs')
        .select('id, name, start_date, athlete_id')
        .eq('box_id', boxId)
        .eq('status', 'active')
      if (progErr) throw progErr

      // Idem : programs.athlete_id référence auth.users, pas public.profiles,
      // donc pas d'embed direct possible ici non plus (même erreur de
      // schema cache que fetchAthletes ci-dessus).
      const athleteIds = [...new Set((programs || []).map(p => p.athlete_id))]
      let profileById = {}
      if (athleteIds.length) {
        const { data: profiles, error: profErr } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', athleteIds)
        if (profErr) throw profErr
        profileById = Object.fromEntries((profiles || []).map(p => [p.id, p]))
      }

      const today = localDateKey()
      const results = []

      for (const program of programs || []) {
        const { data: weekRows, error: weekErr } = await supabase
          .from('program_weeks')
          .select(`
            week_number,
            sessions:program_sessions(
              day_offset,
              blocks:program_blocks(
                id,
                logs:program_block_logs(athlete_id, status)
              )
            )
          `)
          .eq('program_id', program.id)
        if (weekErr) throw weekErr

        let total = 0
        let done = 0
        for (const week of weekRows || []) {
          for (const session of week.sessions || []) {
            const sessionDate = computeSessionDate(program.start_date, week.week_number, session.day_offset)
            if (sessionDate > today) continue // ne compte que le passé/aujourd'hui, pas le futur pas encore dû
            for (const block of session.blocks || []) {
              total += 1
              const log = (block.logs || []).find(l => l.athlete_id === program.athlete_id)
              if (log?.status === 'done') done += 1
            }
          }
        }

        results.push({
          programId: program.id,
          programName: program.name,
          athleteId: program.athlete_id,
          athleteName: profileById[program.athlete_id]?.full_name || 'Athlète',
          total,
          done,
          rate: total > 0 ? Math.round((done / total) * 100) : null,
        })
      }

      results.sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101))
      setRows(results)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [boxId, isCoach])

  useEffect(() => { load() }, [load])

  return { rows, loading, error, reload: load }
}
