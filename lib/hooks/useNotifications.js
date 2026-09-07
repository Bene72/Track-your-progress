'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'

// Notifications in-app (nouveau WOD, réponse dans un chat). Les lignes sont
// créées côté base par des triggers security definer (cf.
// supabase_migration_v4.sql) — le client ne fait jamais d'insert ici, il ne
// fait que lire / marquer comme lu.
export function useNotifications(userId) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, title, body, link, read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30)
    if (!error) setNotifications(data || [])
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!userId) return undefined
    const sub = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => setNotifications(prev => [payload.new, ...prev].slice(0, 30))
      )
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [userId])

  const markAsRead = useCallback(async (id) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)))
    await supabase.from('notifications').update({ read: true }).eq('id', id)
  }, [])

  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    if (!unreadIds.length) return
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds)
  }, [notifications])

  const unreadCount = notifications.filter(n => !n.read).length

  return { notifications, loading, unreadCount, markAsRead, markAllAsRead, reload: load }
}
