'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { localDateKey as toLocalKey } from '../date'
import { WOD_COLUMNS, WOD_SCORE_COLUMNS, PERSONAL_RECORD_COLUMNS, PERSONAL_SESSION_COLUMNS } from '../db-columns'

function startOfWeek(date) {
  const d = new Date(date)
  const diff = (d.getDay() + 6) % 7 // lundi = 0
  d.setDate(d.getDate() - diff)
  return d
}

function endOfWeek(date) {
  const d = startOfWeek(date)
  d.setDate(d.getDate() + 6)
  return d
}

// Étendu aux semaines complètes (lundi→dimanche) qui contiennent le 1er et
// le dernier jour du mois, pas juste le 1er→dernier jour pile — sinon une
// semaine à cheval sur deux mois (ex. WeekStrip d'"Aujourd'hui", qui montre
// toujours la semaine en cours) perd les points des jours du mois voisin.
// "Aujourd'hui" est toujours dans le mois chargé, donc sa semaine est
// désormais toujours entièrement couverte par cette plage élargie.
function monthRange(year, monthIndex) {
  const firstDay = new Date(year, monthIndex, 1)
  const lastDay = new Date(year, monthIndex + 1, 0)
  return { start: toLocalKey(startOfWeek(firstDay)), end: toLocalKey(endOfWeek(lastDay)) }
}

/**
 * Charge, pour un mois donné, les 3 piliers d'entraînement :
 * - WOD publiés de la box (visibles par tous les membres) + mes scores
 * - mes personal_sessions perso (auto-gérées), privées
 * - mes séances de programme (coach → athlète), avec le taux de blocs
 *   marqués "fait" ce jour-là
 * - mes personal_records (PR) perso, privés (affichés à part, pas un pilier)
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
  const [programDays, setProgramDays] = useState([]) // [{ date, sessionId, programId, total, done }]

  const load = useCallback(async () => {
    if (!boxId || !userId) return
    setLoading(true)
    setError(null)
    try {
      const { start, end } = monthRange(month.getFullYear(), month.getMonth())

      const [wodsRes, recRes, sessRes, progSessRes] = await Promise.all([
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
        // La vue calcule déjà la date réelle depuis start_date+semaine+jour ;
        // on filtre ensuite côté client sur le mois affiché (peu de lignes).
        supabase.from('program_sessions_expanded').select('session_id, program_id, session_date, period')
          .eq('athlete_id', userId),
      ])

      if (wodsRes.error) throw wodsRes.error
      if (recRes.error) throw recRes.error
      if (sessRes.error) throw sessRes.error
      if (progSessRes.error) throw progSessRes.error

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

      const sessionsThisMonth = (progSessRes.data || []).filter(s => s.session_date >= start && s.session_date <= end)
      if (sessionsThisMonth.length > 0) {
        const sessionIds = sessionsThisMonth.map(s => s.session_id)
        const { data: blocks, error: blocksErr } = await supabase
          .from('program_blocks')
          .select('id, program_session_id, logs:program_block_logs(athlete_id, status)')
          .in('program_session_id', sessionIds)
        if (blocksErr) throw blocksErr

        const byDate = {}
        for (const s of sessionsThisMonth) {
          byDate[s.session_date] = byDate[s.session_date] || { date: s.session_date, sessionId: s.session_id, programId: s.program_id, total: 0, done: 0 }
        }
        for (const block of blocks || []) {
          const parentSession = sessionsThisMonth.find(s => s.session_id === block.program_session_id)
          if (!parentSession) continue
          const bucket = byDate[parentSession.session_date]
          bucket.total += 1
          const log = (block.logs || []).find(l => l.athlete_id === userId)
          if (log?.status === 'done') bucket.done += 1
        }
        setProgramDays(Object.values(byDate))
      } else {
        setProgramDays([])
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
    month, loading, error, wods, myScores, records, sessions, programDays,
    goToMonth, goToday, reload: load,
  }
}
