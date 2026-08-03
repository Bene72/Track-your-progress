'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { localDateKey as toLocalKey } from '../date'
import { WOD_COLUMNS, WOD_SCORE_COLUMNS, PERSONAL_RECORD_COLUMNS, PERSONAL_SESSION_COLUMNS } from '../db-columns'

function monthRange(year, monthIndex) {
  const start = new Date(year, monthIndex, 1)
  const end = new Date(year, monthIndex + 1, 0) // dernier jour du mois
  return { start: toLocalKey(start), end: toLocalKey(end) }
}

/**
 * Charge, pour un mois donné :
 * - les WOD publiés de la box (visibles par tous les membres)
 * - mes scores sur ces WOD
 * - mes personal_records (PR) perso, privés
 * - mes personal_sessions perso, privées
 *
 * Navigation mois par mois via goToMonth(+1/-1) et goToday().
 */
export function useCalendarData(boxId, userId) {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [wods, setWods] = useState([])
  const [myScores, setMyScores] = useState([])
  const [records, setRecords] = useState([])
  const [sessions, setSessions] = useState([])

  const load = useCallback(async () => {
    if (!boxId || !userId) return
    setLoading(true)
    setError(null)
    try {
      const { start, end } = monthRange(month.getFullYear(), month.getMonth())

      const [wodsRes, recRes, sessRes] = await Promise.all([
        supabase.from('wods').select(WOD_COLUMNS)
          .eq('box_id', boxId).eq('status', 'published')
          .gte('wod_date', start).lte('wod_date', end)
          .order('wod_date', { ascending: true }),
        supabase.from('personal_records').select(PERSONAL_RECORD_COLUMNS)
          .eq('user_id', userId)
          .gte('achieved_at', start).lte('achieved_at', end)
          .order('achieved_at', { ascending: true }),
        supabase.from('personal_sessions').select(PERSONAL_SESSION_COLUMNS)
          .eq('user_id', userId)
          .gte('session_date', start).lte('session_date', end)
          .order('session_date', { ascending: true }),
      ])

      if (wodsRes.error) throw wodsRes.error
      if (recRes.error) throw recRes.error
      if (sessRes.error) throw sessRes.error

      const wodList = wodsRes.data || []
      setWods(wodList)
      setRecords(recRes.data || [])
      setSessions(sessRes.data || [])

      if (wodList.length > 0) {
        const ids = wodList.map(w => w.id)
        const { data: scores, error: scoresErr } = await supabase.from('wod_scores')
          .select(WOD_SCORE_COLUMNS).in('wod_id', ids).eq('user_id', userId)
        if (scoresErr) throw scoresErr
        setMyScores(scores || [])
      } else {
        setMyScores([])
      }
    } catch (e) {
      setError(e.message || 'Erreur de chargement du calendrier')
    } finally {
      setLoading(false)
    }
  }, [boxId, userId, month])

  useEffect(() => { load() }, [load])

  const goToMonth = useCallback((delta) => {
    setMonth(m => new Date(m.getFullYear(), m.getMonth() + delta, 1))
  }, [])

  const goToday = useCallback(() => {
    const d = new Date()
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1))
  }, [])

  return {
    month, loading, error, wods, myScores, records, sessions,
    goToMonth, goToday, reload: load,
  }
}
