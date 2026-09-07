'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

// Version allégée de la requête blocs de usePersonalTraining.js — juste ce
// qu'il faut pour un aperçu (type de bloc + noms des mouvements), sans les
// logs de séries ni les cibles détaillées. Chargé à la demande (seulement
// quand l'aperçu s'ouvre sur "Aujourd'hui"), pas au chargement du calendrier.
export function useSessionBlocksPreview(sessionId) {
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!sessionId) { setBlocks([]); return }
    let cancelled = false
    setLoading(true)
    setError(null)

    supabase
      .from('personal_blocks')
      .select(`
        id, position, block_type, rounds, interval_sec, time_cap_sec,
        exercises:personal_block_exercises(id, position, exercise:personal_exercises(name))
      `)
      .eq('session_id', sessionId)
      .order('position')
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) { setError(err.message); setBlocks([]); return }
        setBlocks((data || []).map(b => ({
          ...b,
          exercises: (b.exercises || []).sort((a, c) => a.position - c.position),
        })))
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [sessionId])

  return { blocks, loading, error }
}
