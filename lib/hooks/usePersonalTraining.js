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
  const [sessions, setSessions] = useState([]) // [{ id, session_date, created_at, notes, blocks: [{ id, block_type, rounds, interval_sec, time_cap_sec, result_*, exercises: [{ id, exercise, target_reps, target_weight_kg, target_distance_m, logs: [] }] }] }]
  const [weeklyVolume, setWeeklyVolume] = useState({})

  const fetchCatalog = useCallback(async () => {
    const { data, error } = await supabase
      .from('personal_exercises')
      .select('id, name, muscle_group, owner_id, video_url')
      .order('name')
    if (error) throw error
    setCatalog(data || [])
  }, [])

  const fetchSessions = useCallback(async (dateStr) => {
    if (!userId) return
    const { data: sessionRows, error: sErr } = await supabase
      .from('personal_sessions')
      .select('id, session_date, created_at, notes')
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
          exercise:personal_exercises(id, name, muscle_group, video_url),
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

  // ─── Modèles de séance réutilisables ───────────────────────────
  const [templates, setTemplates] = useState([])

  const fetchTemplates = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('personal_templates')
      .select(`
        id, name, created_at,
        blocks:personal_template_blocks(
          id, position, block_type, rounds, interval_sec, time_cap_sec, notes,
          exercises:personal_template_block_exercises(
            id, position, target_reps, target_weight_kg, target_distance_m,
            exercise:personal_exercises(id, name, muscle_group)
          )
        )
      `)
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    setTemplates((data || []).map(t => ({
      ...t,
      blocks: (t.blocks || []).sort((a, b) => a.position - b.position).map(b => ({
        ...b,
        exercises: (b.exercises || []).sort((a, c) => a.position - c.position),
      })),
    })))
  }, [userId])

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    Promise.all([fetchCatalog(), fetchSessions(viewDate), fetchWeeklyVolume(), fetchTemplates()])
      .finally(() => setLoading(false))
  }, [userId, viewDate, fetchCatalog, fetchSessions, fetchWeeklyVolume, fetchTemplates])

  const changeDate = (dateStr) => setViewDate(dateStr)

  // Crée toujours une NOUVELLE séance pour la date affichée (plusieurs séances
  // par jour possibles, comme plusieurs WOD).
  const createSession = useCallback(async () => {
    const { data, error } = await supabase
      .from('personal_sessions')
      .insert({ user_id: userId, session_date: viewDate })
      .select('id, session_date, created_at, notes')
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

  // Sauvegarde le commentaire libre de la séance (ressenti général, contexte
  // du jour, etc. — distinct des commentaires par bloc qui portent sur
  // l'exécution d'un bloc précis). Nécessite une colonne `notes` (text,
  // nullable) sur la table `personal_sessions`.
  const updateSessionNotes = useCallback(async (sessionId, notes) => {
    const { error } = await supabase
      .from('personal_sessions')
      .update({ notes })
      .eq('id', sessionId)
    if (error) throw error
    setSessions(prev => prev.map(s => (s.id === sessionId ? { ...s, notes } : s)))
  }, [])

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

  // Modifie les réglages d'un bloc existant (rounds, intervalle EMOM, time cap).
  // Ne touche pas au block_type ni aux mouvements déjà présents.
  const updateBlock = useCallback(async (blockId, { rounds, intervalSec, timeCapSec, notes } = {}) => {
    const patch = {}
    if (rounds !== undefined) patch.rounds = rounds
    if (intervalSec !== undefined) patch.interval_sec = intervalSec
    if (timeCapSec !== undefined) patch.time_cap_sec = timeCapSec
    if (notes !== undefined) patch.notes = notes
    const { error } = await supabase
      .from('personal_blocks')
      .update(patch)
      .eq('id', blockId)
    if (error) throw error
    setSessions(prev => prev.map(s => ({
      ...s,
      blocks: s.blocks.map(b => (b.id === blockId ? { ...b, ...patch } : b)),
    })))
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
      .select('id, position, target_reps, target_weight_kg, target_distance_m, exercise:personal_exercises(id, name, muscle_group, video_url)')
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

  // Dernière performance connue de l'utilisateur sur un mouvement (tous
  // exercices confondus dans le temps), utilisée pour pré-remplir les
  // champs reps/poids/distance quand on ajoute ce mouvement à une séance
  // (cf. AddToBlockInline). Renvoie null si jamais logué.
  const getLastPerformance = useCallback(async (exerciseId) => {
    if (!userId || !exerciseId) return null
    const { data, error } = await supabase
      .from('personal_exercise_history')
      .select('reps, weight_kg, distance_m, session_date, round_number')
      .eq('user_id', userId)
      .eq('exercise_id', exerciseId)
      .order('session_date', { ascending: false })
      .order('round_number', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (error) { console.error(error); return null }
    return data || null
  }, [userId])

  // Réordonne les blocs d'une séance (drag & drop). Optimiste côté état local,
  // puis persiste chaque nouvelle position en base.
  const reorderBlocks = useCallback(async (sessionId, orderedBlockIds) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s
      const byId = Object.fromEntries(s.blocks.map(b => [b.id, b]))
      return { ...s, blocks: orderedBlockIds.map((id, idx) => ({ ...byId[id], position: idx })) }
    }))
    const { error } = await Promise.all(
      orderedBlockIds.map((id, idx) => supabase.from('personal_blocks').update({ position: idx }).eq('id', id))
    ).then(results => ({ error: results.find(r => r.error)?.error }))
    if (error) throw error
  }, [])

  // Duplique une séance entière (structure des blocs + mouvements + cibles)
  // vers une autre date, SANS copier les logs déjà réalisés (nouvelle feuille
  // blanche à remplir). Pratique pour relancer "la même séance qu'hier/la
  // semaine dernière" sans tout retaper.
  const duplicateSession = useCallback(async (sessionId, targetDateStr) => {
    const source = sessions.find(s => s.id === sessionId)
    if (!source) throw new Error('Séance introuvable.')

    const { data: newSession, error: sessErr } = await supabase
      .from('personal_sessions')
      .insert({ user_id: userId, session_date: targetDateStr })
      .select('id, session_date, created_at, notes')
      .single()
    if (sessErr) throw sessErr

    for (const block of source.blocks) {
      const { data: newBlock, error: blockErr } = await supabase
        .from('personal_blocks')
        .insert({
          session_id: newSession.id,
          position: block.position,
          block_type: block.block_type,
          rounds: block.rounds,
          interval_sec: block.interval_sec,
          time_cap_sec: block.time_cap_sec,
        })
        .select('id')
        .single()
      if (blockErr) throw blockErr

      for (const be of block.exercises) {
        const { data: newBe, error: beErr } = await supabase
          .from('personal_block_exercises')
          .insert({
            block_id: newBlock.id,
            exercise_id: be.exercise.id,
            position: be.position,
            target_reps: be.target_reps,
            target_weight_kg: be.target_weight_kg,
            target_distance_m: be.target_distance_m,
          })
          .select('id')
          .single()
        if (beErr) throw beErr

        if (block.rounds) {
          const rows = Array.from({ length: block.rounds }, (_, i) => ({
            block_exercise_id: newBe.id,
            round_number: i + 1,
            reps: be.target_reps,
            weight_kg: be.target_weight_kg,
            distance_m: be.target_distance_m,
          }))
          const { error: logErr } = await supabase.from('personal_set_logs').insert(rows)
          if (logErr) throw logErr
        }
      }
    }

    if (targetDateStr === viewDate) await fetchSessions(viewDate)
    return newSession
  }, [sessions, userId, viewDate, fetchSessions])

  // Enregistre la structure actuelle d'une séance (blocs + mouvements + cibles,
  // pas les logs) comme modèle réutilisable.
  const saveSessionAsTemplate = useCallback(async (sessionId, name) => {
    const source = sessions.find(s => s.id === sessionId)
    if (!source) throw new Error('Séance introuvable.')

    const { data: template, error: tErr } = await supabase
      .from('personal_templates')
      .insert({ owner_id: userId, name })
      .select('id, name, created_at')
      .single()
    if (tErr) throw tErr

    for (const block of source.blocks) {
      const { data: tBlock, error: bErr } = await supabase
        .from('personal_template_blocks')
        .insert({
          template_id: template.id,
          position: block.position,
          block_type: block.block_type,
          rounds: block.rounds,
          interval_sec: block.interval_sec,
          time_cap_sec: block.time_cap_sec,
          notes: block.notes,
        })
        .select('id')
        .single()
      if (bErr) throw bErr

      if (block.exercises.length) {
        const rows = block.exercises.map(be => ({
          template_block_id: tBlock.id,
          exercise_id: be.exercise.id,
          position: be.position,
          target_reps: be.target_reps,
          target_weight_kg: be.target_weight_kg,
          target_distance_m: be.target_distance_m,
        }))
        const { error: beErr } = await supabase.from('personal_template_block_exercises').insert(rows)
        if (beErr) throw beErr
      }
    }

    await fetchTemplates()
    return template
  }, [sessions, userId, fetchTemplates])

  // Clone un modèle dans une séance déjà créée (vide ou non) : ajoute les
  // blocs du modèle à la suite des blocs existants de la séance cible.
  const applyTemplateToSession = useCallback(async (templateId, sessionId) => {
    const template = templates.find(t => t.id === templateId)
    if (!template) throw new Error('Modèle introuvable.')
    const session = sessions.find(s => s.id === sessionId)
    let nextPosition = session?.blocks.length || 0

    for (const tBlock of template.blocks) {
      const { data: newBlock, error: blockErr } = await supabase
        .from('personal_blocks')
        .insert({
          session_id: sessionId,
          position: nextPosition++,
          block_type: tBlock.block_type,
          rounds: tBlock.rounds,
          interval_sec: tBlock.interval_sec,
          time_cap_sec: tBlock.time_cap_sec,
          notes: tBlock.notes,
        })
        .select('id, position, block_type, rounds, interval_sec, time_cap_sec, result_time_sec, result_rounds, result_reps, notes')
        .single()
      if (blockErr) throw blockErr

      const newExercises = []
      for (const tbe of tBlock.exercises) {
        const { data: newBe, error: beErr } = await supabase
          .from('personal_block_exercises')
          .insert({
            block_id: newBlock.id,
            exercise_id: tbe.exercise.id,
            position: tbe.position,
            target_reps: tbe.target_reps,
            target_weight_kg: tbe.target_weight_kg,
            target_distance_m: tbe.target_distance_m,
          })
          .select('id, position, target_reps, target_weight_kg, target_distance_m, exercise:personal_exercises(id, name, muscle_group, video_url)')
          .single()
        if (beErr) throw beErr

        let logs = []
        if (tBlock.rounds) {
          const rows = Array.from({ length: tBlock.rounds }, (_, i) => ({
            block_exercise_id: newBe.id,
            round_number: i + 1,
            reps: tbe.target_reps,
            weight_kg: tbe.target_weight_kg,
            distance_m: tbe.target_distance_m,
          }))
          const { data: logRows, error: logErr } = await supabase.from('personal_set_logs').insert(rows).select()
          if (logErr) throw logErr
          logs = logRows
        }
        newExercises.push({ ...newBe, logs })
      }

      setSessions(prev => prev.map(s => s.id === sessionId
        ? { ...s, blocks: [...s.blocks, { ...newBlock, exercises: newExercises }] }
        : s))
    }
  }, [templates, sessions])

  const deleteTemplate = useCallback(async (templateId) => {
    const { error } = await supabase.from('personal_templates').delete().eq('id', templateId)
    if (error) throw error
    setTemplates(prev => prev.filter(t => t.id !== templateId))
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
    updateSessionNotes,
    createBlock,
    deleteBlock,
    updateBlock,
    addExerciseToBlock,
    removeExerciseFromBlock,
    moveExerciseToBlock,
    addCustomExercise,
    upsertSetLog,
    setBlockResult,
    getLastPerformance,
    reorderBlocks,
    duplicateSession,
    templates,
    saveSessionAsTemplate,
    applyTemplateToSession,
    deleteTemplate,
  }
}
