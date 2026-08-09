'use client'
import { useState, useEffect, useCallback } from 'react'
// Adapte ce chemin/nom d'import au client Supabase déjà utilisé par useWodData.js
// dans ton projet (ex: '../supabase' ou '../supabaseClient').
import { supabase } from '../supabase'
import { localDateKey } from '../date'

function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// Gère le catalogue d'exercices (par défaut + persos), la séance du jour, et le
// bilan de volume (nb de séries par groupe musculaire) sur les 7 derniers jours glissants.
export function usePersonalTraining(userId) {
  const [loading, setLoading] = useState(true)
  const [catalog, setCatalog] = useState([]) // liste plate d'exercices
  const [sessionDate, setSessionDate] = useState(localDateKey())
  const [session, setSession] = useState(null) // { id, session_date }
  const [sessionExercises, setSessionExercises] = useState([]) // [{ id, exercise, sets: [] }]
  const [weeklyVolume, setWeeklyVolume] = useState({})

  const fetchCatalog = useCallback(async () => {
    const { data, error } = await supabase
      .from('personal_exercises')
      .select('id, name, muscle_group, owner_id')
      .order('name')
    if (error) throw error
    setCatalog(data || [])
  }, [])

  const fetchSessionForDate = useCallback(async (dateStr) => {
    if (!userId) return
    const { data: existing } = await supabase
      .from('personal_sessions')
      .select('id, session_date')
      .eq('user_id', userId)
      .eq('session_date', dateStr)
      .maybeSingle()

    if (!existing) {
      setSession(null)
      setSessionExercises([])
      return
    }
    setSession(existing)

    const { data: rows, error } = await supabase
      .from('personal_session_exercises')
      .select('id, position, exercise:personal_exercises(id, name, muscle_group), sets:personal_sets(id, set_number, reps, weight_kg, rest_sec, rpe)')
      .eq('session_id', existing.id)
      .order('position')
    if (error) throw error
    const withSortedSets = (rows || []).map(r => ({
      ...r,
      sets: (r.sets || []).sort((a, b) => a.set_number - b.set_number),
    }))
    setSessionExercises(withSortedSets)
  }, [userId])

  const fetchWeeklyVolume = useCallback(async () => {
    if (!userId) return
    const today = localDateKey()
    const from = addDaysStr(today, -6)

    const { data: sessions } = await supabase
      .from('personal_sessions')
      .select('id')
      .eq('user_id', userId)
      .gte('session_date', from)
      .lte('session_date', today)
    const sessionIds = (sessions || []).map(s => s.id)
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
    Promise.all([fetchCatalog(), fetchSessionForDate(sessionDate), fetchWeeklyVolume()])
      .finally(() => setLoading(false))
  }, [userId, fetchCatalog, fetchSessionForDate, fetchWeeklyVolume, sessionDate])

  const changeDate = (dateStr) => setSessionDate(dateStr)

  const ensureSession = useCallback(async () => {
    if (session) return session
    const { data, error } = await supabase
      .from('personal_sessions')
      .insert({ user_id: userId, session_date: sessionDate })
      .select('id, session_date')
      .single()
    if (error) throw error
    setSession(data)
    return data
  }, [session, userId, sessionDate])

  const addExercise = useCallback(async (exerciseId) => {
    const s = await ensureSession()
    const { data, error } = await supabase
      .from('personal_session_exercises')
      .insert({ session_id: s.id, exercise_id: exerciseId, position: sessionExercises.length })
      .select('id, position, exercise:personal_exercises(id, name, muscle_group)')
      .single()
    if (error) throw error
    setSessionExercises(prev => [...prev, { ...data, sets: [] }])
  }, [ensureSession, sessionExercises.length])

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

  const deleteSessionExercise = useCallback(async (sessionExerciseId) => {
    const { error } = await supabase.from('personal_session_exercises').delete().eq('id', sessionExerciseId)
    if (error) throw error
    setSessionExercises(prev => prev.filter(e => e.id !== sessionExerciseId))
  }, [])

  const addSet = useCallback(async (sessionExerciseId, { reps, weight_kg, rest_sec, rpe }) => {
    const current = sessionExercises.find(e => e.id === sessionExerciseId)
    const setNumber = (current?.sets?.length || 0) + 1
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
    setSessionExercises(prev => prev.map(e => e.id === sessionExerciseId ? { ...e, sets: [...e.sets, data] } : e))
    fetchWeeklyVolume()
  }, [sessionExercises, fetchWeeklyVolume])

  const deleteSet = useCallback(async (sessionExerciseId, setId) => {
    const { error } = await supabase.from('personal_sets').delete().eq('id', setId)
    if (error) throw error
    setSessionExercises(prev => prev.map(e => e.id === sessionExerciseId ? { ...e, sets: e.sets.filter(s => s.id !== setId) } : e))
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
    sessionDate,
    changeDate,
    sessionExercises,
    weeklyVolume,
    addExercise,
    addCustomExercise,
    deleteSessionExercise,
    addSet,
    deleteSet,
  }
}
