'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../supabase'

const STORAGE_KEY = 'boxlog_active_box_id'

/**
 * Charge les box du user (via box_members), gère la sélection de
 * la box active (multi-box), et expose le rôle (coach/member) sur
 * cette box.
 */
export function useBox() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)
  const [memberships, setMemberships] = useState([]) // [{box_id, role, boxes:{name}}]
  const [activeBoxId, setActiveBoxId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }
    setUserId(user.id)

    const { data, error } = await supabase
      .from('box_members')
      .select('box_id, role, status, boxes ( id, name, slug )')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (error) { console.error(error); setLoading(false); return }

    const active = (data || []).filter(m => m.boxes)
    setMemberships(active)

    if (active.length === 0) {
      router.push('/onboarding')
      return
    }

    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
    const validStored = active.find(m => m.box_id === stored)
    const chosen = validStored ? stored : active[0].box_id
    setActiveBoxId(chosen)
    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])

  const switchBox = useCallback((boxId) => {
    setActiveBoxId(boxId)
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, boxId)
  }, [])

  const activeMembership = memberships.find(m => m.box_id === activeBoxId)
  const role = activeMembership?.role || 'member'
  const isCoach = role === 'coach'
  const activeBoxName = activeMembership?.boxes?.name || ''

  return {
    loading, userId, memberships, activeBoxId, activeBoxName,
    role, isCoach, switchBox, reload: load,
  }
}
