'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { todayKey } from '../date'
import { WOD_COLUMNS, WOD_SCORE_COLUMNS, PROFILE_COLUMNS_MINIMAL } from '../db-columns'

export function useWodData(boxId, userId) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [todayWod, setTodayWod] = useState(null)
  const [myTodayScore, setMyTodayScore] = useState(null)
  const [feed, setFeed] = useState([])          // WOD publiés, historique
  const [pending, setPending] = useState([])     // propositions en attente (coach)

  const loadAll = useCallback(async () => {
    if (!boxId) return
    setLoading(true)
    setError(null)
    try {
      const [wodsRes, pendingRes] = await Promise.all([
        supabase.from('wods').select(WOD_COLUMNS)
          .eq('box_id', boxId).eq('status', 'published')
          .order('wod_date', { ascending: false }).limit(30),
        supabase.from('wods').select(WOD_COLUMNS)
          .eq('box_id', boxId).eq('status', 'pending')
          .order('created_at', { ascending: false }),
      ])
      if (wodsRes.error) throw wodsRes.error
      const wods = wodsRes.data || []
      setFeed(wods)
      setPending(pendingRes.data || [])

      const today = wods.find(w => w.wod_date === todayKey()) || null
      setTodayWod(today)

      if (today && userId) {
        const { data: score } = await supabase.from('wod_scores')
          .select(WOD_SCORE_COLUMNS).eq('wod_id', today.id).eq('user_id', userId).maybeSingle()
        setMyTodayScore(score || null)
      } else {
        setMyTodayScore(null)
      }
    } catch (e) {
      setError(e.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [boxId, userId])

  useEffect(() => { loadAll() }, [loadAll])

  const createWod = useCallback(async (payload) => {
    const { data, error } = await supabase.from('wods')
      .insert({ ...payload, box_id: boxId, created_by: userId })
      .select().single()
    if (error) throw error
    await loadAll()
    return data
  }, [boxId, userId, loadAll])

  const decideWod = useCallback(async (wodId, decision) => {
    // decision: 'published' | 'rejected'
    const { error } = await supabase.from('wods').update({ status: decision }).eq('id', wodId)
    if (error) throw error
    await loadAll()
  }, [loadAll])

  // Suppression d'un WOD. La RLS garantit déjà côté serveur que seuls
  // l'auteur ou le coach de la box peuvent supprimer (voir policy
  // wods_delete_coach_or_own_pending) — ce callback est le point d'entrée
  // côté client, avec refresh des listes après suppression.
  const deleteWod = useCallback(async (wodId) => {
    const { error } = await supabase.from('wods').delete().eq('id', wodId)
    if (error) throw error
    await loadAll()
  }, [loadAll])

  const submitScore = useCallback(async (wodId, payload) => {
    const { data, error } = await supabase.from('wod_scores')
      .upsert({ ...payload, wod_id: wodId, box_id: boxId, user_id: userId }, { onConflict: 'wod_id,user_id' })
      .select().single()
    if (error) throw error
    await loadAll()
    return data
  }, [boxId, userId, loadAll])

  const getLeaderboard = useCallback(async (wodId) => {
    const { data, error } = await supabase.from('wod_scores')
      .select(WOD_SCORE_COLUMNS)
      .eq('wod_id', wodId)
    if (error) throw error
    let scores = data || []
    const userIds = [...new Set(scores.map(row => row.user_id).filter(Boolean))]
    if (userIds.length > 0) {
      const { data: profiles, error: profError } = await supabase.from('profiles').select(PROFILE_COLUMNS_MINIMAL).in('id', userIds)
      if (profError) throw profError
      const byId = Object.fromEntries((profiles || []).map(p => [p.id, p]))
      scores = scores.map(row => ({ ...row, profiles: byId[row.user_id] || null }))
    }
    return scores
  }, [])

  return {
    loading, error, todayWod, myTodayScore, feed, pending,
    createWod, decideWod, deleteWod, submitScore, getLeaderboard, reload: loadAll,
  }
}
