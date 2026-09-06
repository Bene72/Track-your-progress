'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../supabase'

const PAGE_SIZE = 50

// Chat temps réel scopé à une box (+ un salon, "general" par défaut).
// Peut aussi être scopé à un wod_id ou session_id précis pour afficher un
// fil de discussion sous un WOD ou une séance perso (cf. capture "Répondre
// dans le chat" sous un bloc de séance).
export function useBoxChat({ boxId, channel = 'general', wodId = null, sessionId = null, programBlockId = null, userId }) {
  const [messages, setMessages] = useState([])
  const [profiles, setProfiles] = useState({}) // { userId: { full_name } }
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const channelRef = useRef(null)

  const hydrateProfiles = useCallback(async (userIds) => {
    const missing = userIds.filter(id => !profiles[id])
    if (missing.length === 0) return
    const { data } = await supabase.from('profiles').select('id, full_name').in('id', missing)
    if (data) {
      setProfiles(prev => ({ ...prev, ...Object.fromEntries(data.map(p => [p.id, p])) }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const load = useCallback(async () => {
    if (!boxId) return
    setLoading(true)
    setError(null)
    let query = supabase
      .from('chat_messages')
      .select('id, box_id, channel, user_id, wod_id, session_id, program_block_id, content, created_at')
      .eq('box_id', boxId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (wodId) query = query.eq('wod_id', wodId)
    else if (sessionId) query = query.eq('session_id', sessionId)
    else if (programBlockId) query = query.eq('program_block_id', programBlockId)
    else query = query.eq('channel', channel).is('wod_id', null).is('session_id', null).is('program_block_id', null)

    const { data, error: fetchError } = await query
    if (fetchError) {
      setError(fetchError.message || 'Impossible de charger le chat.')
      setLoading(false)
      return
    }
    const ordered = (data || []).slice().reverse()
    setMessages(ordered)
    await hydrateProfiles([...new Set(ordered.map(m => m.user_id))])
    setLoading(false)
  }, [boxId, channel, wodId, sessionId, programBlockId, hydrateProfiles])

  useEffect(() => { load() }, [load])

  // Abonnement Realtime : chaque nouveau message inséré dans chat_messages
  // (filtré par box_id côté serveur) est poussé instantanément à tous les
  // membres connectés, sans polling.
  useEffect(() => {
    if (!boxId) return undefined
    const sub = supabase
      .channel(`chat:${boxId}:${wodId || sessionId || programBlockId || channel}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `box_id=eq.${boxId}` },
        (payload) => {
          const row = payload.new
          const matchesThread = wodId
            ? row.wod_id === wodId
            : sessionId
              ? row.session_id === sessionId
              : programBlockId
                ? row.program_block_id === programBlockId
                : row.channel === channel && !row.wod_id && !row.session_id && !row.program_block_id
          if (!matchesThread) return
          setMessages(prev => (prev.some(m => m.id === row.id) ? prev : [...prev, row]))
          hydrateProfiles([row.user_id])
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'chat_messages', filter: `box_id=eq.${boxId}` },
        (payload) => {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id))
        }
      )
      .subscribe()
    channelRef.current = sub
    return () => { supabase.removeChannel(sub) }
  }, [boxId, channel, wodId, sessionId, programBlockId, hydrateProfiles])

  const sendMessage = useCallback(async (content) => {
    const trimmed = (content || '').trim()
    if (!trimmed || !boxId || !userId) return
    setSending(true)
    setError(null)
    // Insertion optimiste : l'expéditeur voit son message tout de suite,
    // sans attendre l'aller-retour Realtime (meilleure sensation de vitesse).
    const optimistic = {
      id: `optimistic-${Date.now()}`,
      box_id: boxId,
      channel,
      user_id: userId,
      wod_id: wodId,
      session_id: sessionId,
      program_block_id: programBlockId,
      content: trimmed,
      created_at: new Date().toISOString(),
      _optimistic: true,
    }
    setMessages(prev => [...prev, optimistic])
    try {
      const { data, error: insertError } = await supabase
        .from('chat_messages')
        .insert({ box_id: boxId, channel, user_id: userId, wod_id: wodId, session_id: sessionId, program_block_id: programBlockId, content: trimmed })
        .select()
        .single()
      if (insertError) throw insertError
      setMessages(prev => prev.map(m => (m.id === optimistic.id ? data : m)))
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      setError(err.message || 'Message non envoyé.')
      throw err
    } finally {
      setSending(false)
    }
  }, [boxId, channel, wodId, sessionId, programBlockId, userId])

  const deleteMessage = useCallback(async (messageId) => {
    const { error: deleteError } = await supabase.from('chat_messages').delete().eq('id', messageId)
    if (deleteError) throw deleteError
    setMessages(prev => prev.filter(m => m.id !== messageId))
  }, [])

  return { messages, profiles, loading, sending, error, sendMessage, deleteMessage, reload: load }
}
