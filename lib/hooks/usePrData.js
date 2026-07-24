'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'

export function usePrData(userId) {
  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState([])
  const [sessions, setSessions] = useState([])
  const [latestByMovement, setLatestByMovement] = useState([])

  const loadAll = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const [recRes, sessRes, latestRes] = await Promise.all([
      supabase.from('personal_records').select('*').eq('user_id', userId).order('achieved_at', { ascending: false }),
      supabase.from('personal_sessions').select('*').eq('user_id', userId).order('session_date', { ascending: false }),
      supabase.from('personal_records_latest').select('*').eq('user_id', userId),
    ])
    setRecords(recRes.data || [])
    setSessions(sessRes.data || [])
    setLatestByMovement(latestRes.data || [])
    setLoading(false)
  }, [userId])

  useEffect(() => { loadAll() }, [loadAll])

  const addRecord = useCallback(async (payload) => {
    const { data, error } = await supabase.from('personal_records')
      .insert({ ...payload, user_id: userId }).select().single()
    if (error) throw error
    await loadAll()
    return data
  }, [userId, loadAll])

  const addSession = useCallback(async (payload) => {
    const { data, error } = await supabase.from('personal_sessions')
      .insert({ ...payload, user_id: userId }).select().single()
    if (error) throw error
    await loadAll()
    return data
  }, [userId, loadAll])

  const deleteRecord = useCallback(async (id) => {
    const { error } = await supabase.from('personal_records').delete().eq('id', id)
    if (error) throw error
    await loadAll()
  }, [loadAll])

  return { loading, records, sessions, latestByMovement, addRecord, addSession, deleteRecord, reload: loadAll }
}
