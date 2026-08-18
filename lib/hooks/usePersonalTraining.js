'use client'
import { useState, useEffect, useCallback } from 'react'
// Adapte ce chemin si besoin au client Supabase déjà utilisé par useWodData.js.
import { supabase } from '../supabase'
import { localDateKey } from '../date'

function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// Gère le catalogue d'exercices (par défaut + persos), les séances rattachées à une
// date donnée, organisées en BLOCS (straight_sets / superset / emom / amrap / for_time).
// Un bloc regroupe un ou plusieurs mouvements exécutés ensemble (ex: EMOM avec 2 mouvements
// alternés, ou superset). Le bilan de volume calcule le nb de séries par groupe musculaire
// sur les 7 derniers jours glissants.
export function usePersonalTraining(userId) {
  const [loading, setLoading] = useState(true)
  const [catalog, setCatalog] = useState([])
  const [viewDate, setViewDate] = useState(localDateKey())
  const [sessions, setSessions] = useState([]) // [{ id, session_date, created_at, blocks: [{ id, block_type, rounds, interval_sec, time_cap_sec, result_*, exercises: [{ id, exercise, target_reps, target_weight_kg, target_distance_m, logs: [] }] }] }]
  const [weeklyVolume, setWeeklyVolume] = useState({})

  const fetchCatalog = useCallback(async () => {
    const { data, error } = await supabase
      .from('personal_exercises')
      .select('id, name, muscle_group, owner_id')
      .order('name')
    if (error) throw error
    setCatalog(data || [])
  }, [])

  const fetchSessions = useCallback(async (dateStr) => {
    if (!userId) return
    const { data: sessionRows, error: sErr } = await supabase
      .from('personal_sessions')
      .select('id, session_date, created_at')
      .eq('user_id', userId)
      .eq('session_date', dateStr)
      .order('created_at')
    if (sErr) throw sErr

    if (!sessionRows || !sessionRows.length) { setSessions([]); return }

    const sessionIds = sessionRows.map(s => s.id)
    const { data: blockRows, error: bErr } = await supabase
      .from('personal_blocks')
      .select(`
        id, session_id, position, block_type, rounds, interval_sec, time_cap_sec,
        result_time_sec, result_rounds, result_reps, notes,
        exercises:personal_block_exercises(
          id, position, target_reps, target_weight_kg, target_distance_m,
          exercise:personal_exercises(id, name, muscle_group),
          logs:personal_set_logs(id, round_number, reps, weight_kg, distance_m, rest_sec, rpe)
        )
      `)
      .in('session_id', sessionIds)
      .order('position')
    if (bErr) throw bErr

    const grouped = sessionRows.map(s => ({
      ...s,
      blocks: (blockRows || [])
        .filter(b => b.session_id === s.id)
        .map(b => ({
          ...b,
          exercises: (b.exercises || [])
            .sort((a, c) => a.position - c.position)
            .map(be => ({ ...be, logs: (be.logs || []).sort((a, c) => a.round_number - c.round_number) })),
        })),
    }))
    setSessions(grouped)
  }, [userId])

  const fetchWeeklyVolume = useCallback(async () => {
    if (!userId) return
    const today = localDateKey()
    const from = addDaysStr(today, -6)

    const { data: weekSessions } = await supabase
      .from('personal_sessions')
      .select('id')
      .eq('user_id', userId)
      .gte('session_date', from)
      .lte('session_date', today)
    const sessionIds = (weekSessions || []).map(s => s.id)
    if (!sessionIds.length) { setWeeklyVolume({}); return }

    const { data: blockExs } = await supabase
      .from('personal_block_exercises')
      .select('id, exercise:personal_exercises(muscle_group), block:personal_blocks!inner(session_id)')
      .in('block.session_id', sessionIds)
    const beToMuscle = {}
    ;(blockExs || []).forEach(be => { beToMuscle[be.id] = be.exercise?.muscle_group })
    const beIds = (blockExs || []).map(be => be.id)
    if (!beIds.length) { setWeeklyVolume({}); return }

    const { data: logs } = await supabase
      .from('personal_set_logs')
      .select('id, block_exercise_id')
      .in('block_exercise_id', beIds)

    const totals = {}
    ;(logs || []).forEach(l => {
      const mg = beToMuscle[l.block_exercise_id]
      if (mg) totals[mg] = (totals[mg] || 0) + 1
    })
    setWeeklyVolume(totals)
  }, [userId])

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    Promise.all([fetchCatalog(), fetchSessions(viewDate), fetchWeeklyVolume()])
      .finally(() => setLoading(false))
  }, [userId, viewDate, fetchCatalog, fetchSessions, fetchWeeklyVolume])

  const changeDate = (dateStr) => setViewDate(dateStr)

  // Crée toujours une NOUVELLE séance pour la date affichée (plusieurs séances
  // par jour possibles, comme plusieurs WOD).
  const createSession = useCallback(async () => {
    const { data, error } = await supabase
      .from('personal_sessions')
      .insert({ user_id: userId, session_date: viewDate })
      .select('id, session_date, created_at')
      .single()
    if (error) throw error
    setSessions(prev => [...prev, { ...data, blocks: [] }])
    return data
  }, [userId, viewDate])

  // Supprime une séance entière (jour logué) : cascade DB gère blocs/mouvements/logs.
  const deleteSession = useCallback(async (sessionId) => {
    const { error } = await supabase.from('personal_sessions').delete().eq('id', sessionId)
    if (error) throw error
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    fetchWeeklyVolume()
  }, [fetchWeeklyVolume])

  // Crée un bloc vide (straight_sets / superset / emom / amrap / for_time) dans une séance.
  const createBlock = useCallback(async (sessionId, blockType, { rounds = null, intervalSec = null, timeCapSec = null } = {}) => {
    const session = sessions.find(s => s.id === sessionId)
    const { data, error } = await supabase
      .from('personal_blocks')
      .insert({
        session_id: sessionId,
        position: session?.blocks.length || 0,
        block_type: blockType,
        rounds,
        interval_sec: intervalSec,
        time_cap_sec: timeCapSec,
      })
      .select('id, position, block_type, rounds, interval_sec, time_cap_sec, result_time_sec, result_rounds, result_reps, notes')
      .single()
    if (error) throw error
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, blocks: [...s.blocks, { ...data, exercises: [] }] } : s))
    return data
  }, [sessions])

  const deleteBlock = useCallback(async (blockId) => {
    const { error } = await supabase.from('personal_blocks').delete().eq('id', blockId)
    if (error) throw error
    setSessions(prev => prev.map(s => ({ ...s, blocks: s.blocks.filter(b => b.id !== blockId) })))
  }, [])

  // Ajoute un mouvement à un bloc EXISTANT (ex: glisser un 2e exercice dans un EMOM/superset).
  // Génère automatiquement les logs de rounds (un par round du bloc) pré-remplis avec la cible.
  const addExerciseToBlock = useCallback(async (blockId, exerciseId, { targetReps = null, targetWeightKg = null, targetDistanceM = null } = {}) => {
    const block = sessions.flatMap(s => s.blocks).find(b => b.id === blockId)
    const { data: beData, error: beErr } = await supabase
      .from('personal_block_exercises')
      .insert({
        block_id: blockId,
        exercise_id: exerciseId,
        position: block?.exercises.length || 0,
        target_reps: targetReps,
        target_weight_kg: targetWeightKg,
        target_distance_m: targetDistanceM,
      })
      .select('id, position, target_reps, target_weight_kg, target_distance_m, exercise:personal_exercises(id, name, muscle_group)')
      .single()
    if (beErr) throw beErr

    let logs = []
    if (block?.rounds) {
      const rows = Array.from({ length: block.rounds }, (_, i) => ({
        block_exercise_id: beData.id,
        round_number: i + 1,
        reps: targetReps,
        weight_kg: targetWeightKg,
        distance_m: targetDistanceM,
      }))
      const { data: logRows, error: logErr } = await supabase.from('personal_set_logs').insert(rows).select()
      if (logErr) throw logErr
      logs = logRows
    }

    setSessions(prev => prev.map(s => ({
      ...s,
      blocks: s.blocks.map(b => b.id === blockId ? { ...b, exercises: [...b.exercises, { ...beData, logs }] } : b),
    })))
    return beData
  }, [sessions])

  const removeExerciseFromBlock = useCallback(async (blockExerciseId) => {
    const { error } = await supabase.from('personal_block_exercises').delete().eq('id', blockExerciseId)
    if (error) throw error
    setSessions(prev => prev.map(s => ({
      ...s,
      blocks: s.blocks.map(b => ({ ...b, exercises: b.exercises.filter(e => e.id !== blockExerciseId) })),
    })))
  }, [])

  // "Glissement" pour créer/étendre un superset ou fusionner un mouvement dans un bloc EMOM
  // existant : déplace un mouvement d'un bloc vers un autre (ex: drag & drop dans l'UI).
  const moveExerciseToBlock = useCallback(async (blockExerciseId, targetBlockId) => {
    const { error } = await supabase
      .from('personal_block_exercises')
      .update({ block_id: targetBlockId })
      .eq('id', blockExerciseId)
    if (error) throw error
    await fetchSessions(viewDate)
  }, [fetchSessions, viewDate])

  const addCustomExercise = useCallback(async (name, muscleGroup) => {
    const { data, error } = await supabase
      .from('personal_exercises')
      .insert({ owner_id: userId, name, muscle_group: muscleGroup, is_default: false })
      .select('id, name, muscle_group, owner_id')
      .single()
    if (error) throw error
    setCatalog(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    return data
  }, [userId])

  // Ajoute/édite le log d'un round précis pour un mouvement (ex: poids réel soulevé au round 3).
  const upsertSetLog = useCallback(async (blockExerciseId, roundNumber, { reps, weight_kg, distance_m, rest_sec, rpe }) => {
    const be = sessions.flatMap(s => s.blocks).flatMap(b => b.exercises).find(e => e.id === blockExerciseId)
    const existing = be?.logs.find(l => l.round_number === roundNumber)

    let data, error
    if (existing) {
      ;({ data, error } = await supabase
        .from('personal_set_logs')
        .update({ reps, weight_kg, distance_m, rest_sec, rpe })
        .eq('id', existing.id)
        .select()
        .single())
    } else {
      ;({ data, error } = await supabase
        .from('personal_set_logs')
        .insert({ block_exercise_id: blockExerciseId, round_number: roundNumber, reps, weight_kg, distance_m, rest_sec, rpe })
        .select()
        .single())
    }
    if (error) throw error

    setSessions(prev => prev.map(s => ({
      ...s,
      blocks: s.blocks.map(b => ({
        ...b,
        exercises: b.exercises.map(e => e.id !== blockExerciseId ? e : {
          ...e,
          logs: existing ? e.logs.map(l => l.id === data.id ? data : l) : [...e.logs, data],
        }),
      })),
    })))
    fetchWeeklyVolume()
  }, [sessions, fetchWeeklyVolume])

  // Enregistre le résultat d'un bloc AMRAP / for_time.
  const setBlockResult = useCallback(async (blockId, { result_time_sec, result_rounds, result_reps } = {}) => {
    const { error } = await supabase
      .from('personal_blocks')
      .update({ result_time_sec, result_rounds, result_reps })
      .eq('id', blockId)
    if (error) throw error
    setSessions(prev => prev.map(s => ({
      ...s,
      blocks: s.blocks.map(b => b.id === blockId ? { ...b, result_time_sec, result_rounds, result_reps } : b),
    })))
  }, [])

  const catalogByMuscle = catalog.reduce((acc, ex) => {
    acc[ex.muscle_group] = acc[ex.muscle_group] || []
    acc[ex.muscle_group].push(ex)
    return acc
  }, {})

  return {
    loading,
    catalog,
    catalogByMuscle,
    viewDate,
    changeDate,
    sessions,
    weeklyVolume,
    createSession,
    deleteSession,
    createBlock,
    deleteBlock,
    addExerciseToBlock,
    removeExerciseFromBlock,
    moveExerciseToBlock,
    addCustomExercise,
    upsertSetLog,
    setBlockResult,
  }
}
