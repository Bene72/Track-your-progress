'use client'
import { useState, useEffect, useCallback } from 'react'
// Adapte ce chemin si besoin au client Supabase déjà utilisé par useWodData.js.
import { supabase } from '../supabase'
import { localDateKey } from '../date'

function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// Gère le catalogue d'exercices (par défaut + persos), les séances rattachées à une
// date donnée (plusieurs possibles par jour, comme plusieurs WOD), et le bilan de
// volume (nb de séries par groupe musculaire) sur les 7 derniers jours glissants.
export function usePersonalTraining(userId) {
  const [loading, setLoading] = useState(true)
  const [catalog, setCatalog] = useState([])
  const [viewDate, setViewDate] = useState(localDateKey())
  const [sessions, setSessions] = useState([]) // [{ id, session_date, created_at, exercises: [{ id, exercise, sets: [] }] }]
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
    const { data: seRows, error: seErr } = await supabase
      .from('personal_session_exercises')
      .select('id, session_id, position, superset_group, exercise:personal_exercises(id, name, muscle_group), sets:personal_sets(id, set_number, reps, weight_kg, rest_sec, rpe)')
      .in('session_id', sessionIds)
      .order('position')
    if (seErr) throw seErr

    const grouped = sessionRows.map(s => ({
      ...s,
      exercises: (seRows || [])
        .filter(se => se.session_id === s.id)
        .map(se => ({ ...se, sets: (se.sets || []).sort((a, b) => a.set_number - b.set_number) })),
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

    const { data: sessionExs } = await supabase
      .from('personal_session_exercises')
      .select('id, exercise:personal_exercises(muscle_group)')
      .in('session_id', sessionIds)
    const seToMuscle = {}
    ;(sessionExs || []).forEach(se => { seToMuscle[se.id] = se.exercise?.muscle_group })
    const seIds = (sessionExs || []).map(se => se.id)
    if (!seIds.length) { setWeeklyVolume({}); return }

    const { data: sets } = await supabase
      .from('personal_sets')
      .select('id, session_exercise_id')
      .in('session_exercise_id', seIds)

    const totals = {}
    ;(sets || []).forEach(s => {
      const mg = seToMuscle[s.session_exercise_id]
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
    setSessions(prev => [...prev, { ...data, exercises: [] }])
    return data
  }, [userId, viewDate])

  const addExercise = useCallback(async (sessionId, exerciseId, supersetGroup = null) => {
    const session = sessions.find(s => s.id === sessionId)
    const { data, error } = await supabase
      .from('personal_session_exercises')
      .insert({ session_id: sessionId, exercise_id: exerciseId, position: session?.exercises.length || 0, superset_group: supersetGroup })
      .select('id, position, superset_group, exercise:personal_exercises(id, name, muscle_group)')
      .single()
    if (error) throw error
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, exercises: [...s.exercises, { ...data, sets: [] }] } : s))
  }, [sessions])

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

  // Lie (ou délie avec null) un exercice existant à un groupe de superset.
  const setSupersetGroup = useCallback(async (sessionExerciseId, supersetGroup) => {
    const { error } = await supabase
      .from('personal_session_exercises')
      .update({ superset_group: supersetGroup })
      .eq('id', sessionExerciseId)
    if (error) throw error
    setSessions(prev => prev.map(s => ({
      ...s,
      exercises: s.exercises.map(e => e.id === sessionExerciseId ? { ...e, superset_group: supersetGroup } : e),
    })))
  }, [])

  // Supprime une séance entière (jour logué) : sets -> exercices -> séance.
  const deleteSession = useCallback(async (sessionId) => {
    const session = sessions.find(s => s.id === sessionId)
    const seIds = (session?.exercises || []).map(e => e.id)
    if (seIds.length) {
      const { error: setsErr } = await supabase.from('personal_sets').delete().in('session_exercise_id', seIds)
      if (setsErr) throw setsErr
      const { error: seErr } = await supabase.from('personal_session_exercises').delete().in('id', seIds)
      if (seErr) throw seErr
    }
    const { error } = await supabase.from('personal_sessions').delete().eq('id', sessionId)
    if (error) throw error
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    fetchWeeklyVolume()
  }, [sessions, fetchWeeklyVolume])

  const deleteSessionExercise = useCallback(async (sessionExerciseId) => {
    const { error } = await supabase.from('personal_session_exercises').delete().eq('id', sessionExerciseId)
    if (error) throw error
    setSessions(prev => prev.map(s => ({ ...s, exercises: s.exercises.filter(e => e.id !== sessionExerciseId) })))
  }, [])

  const addSet = useCallback(async (sessionExerciseId, { reps, weight_kg, rest_sec, rpe }) => {
    let setNumber = 1
    sessions.forEach(s => s.exercises.forEach(e => { if (e.id === sessionExerciseId) setNumber = (e.sets.length || 0) + 1 }))
    const { data, error } = await supabase
      .from('personal_sets')
      .insert({
        session_exercise_id: sessionExerciseId,
        set_number: setNumber,
        reps,
        weight_kg: weight_kg || null,
        rest_sec: rest_sec || null,
        rpe: rpe || null,
      })
      .select('id, set_number, reps, weight_kg, rest_sec, rpe')
      .single()
    if (error) throw error
    setSessions(prev => prev.map(s => ({
      ...s,
      exercises: s.exercises.map(e => e.id === sessionExerciseId ? { ...e, sets: [...e.sets, data] } : e),
    })))
    fetchWeeklyVolume()
  }, [sessions, fetchWeeklyVolume])

  const deleteSet = useCallback(async (setId) => {
    const { error } = await supabase.from('personal_sets').delete().eq('id', setId)
    if (error) throw error
    setSessions(prev => prev.map(s => ({
      ...s,
      exercises: s.exercises.map(e => ({ ...e, sets: e.sets.filter(st => st.id !== setId) })),
    })))
    fetchWeeklyVolume()
  }, [fetchWeeklyVolume])

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
    addExercise,
    setSupersetGroup,
    addCustomExercise,
    deleteSessionExercise,
    addSet,
    deleteSet,
  }
}
