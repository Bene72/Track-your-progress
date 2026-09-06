'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'

// Badge "non lu" sur l'onglet Chat : compare le dernier message du salon
// général de la box à chat_reads.last_read_at pour cet utilisateur.
export function useChatUnread(userId, boxId, channel = 'general') {
  const [unreadCount, setUnreadCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!userId || !boxId) { setUnreadCount(0); return }
    const { data: readRow } = await supabase
      .from('chat_reads')
      .select('last_read_at')
      .eq('user_id', userId)
      .eq('box_id', boxId)
      .eq('channel', channel)
      .maybeSingle()
    const since = readRow?.last_read_at || '1970-01-01T00:00:00Z'

    const { count } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('box_id', boxId)
      .eq('channel', channel)
      .is('wod_id', null)
      .is('session_id', null)
      .neq('user_id', userId)
      .gt('created_at', since)
    setUnreadCount(count || 0)
  }, [userId, boxId, channel])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    if (!userId || !boxId) return undefined
    const sub = supabase
      .channel(`chat-unread:${boxId}:${channel}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `box_id=eq.${boxId}` },
        (payload) => {
          const row = payload.new
          if (row.channel === channel && !row.wod_id && !row.session_id && row.user_id !== userId) {
            setUnreadCount(c => c + 1)
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [userId, boxId, channel])

  const markRead = useCallback(async () => {
    if (!userId || !boxId) return
    setUnreadCount(0)
    await supabase
      .from('chat_reads')
      .upsert({ user_id: userId, box_id: boxId, channel, last_read_at: new Date().toISOString() })
  }, [userId, boxId, channel])

  return { unreadCount, markRead, refresh }
}
