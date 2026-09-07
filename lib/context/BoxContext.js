'use client'
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../supabase'

const STORAGE_KEY = 'boxlog_active_box_id'

const BoxContext = createContext(null)

/**
 * Provider à placer une seule fois, au niveau du layout dashboard.
 *
 * Avant : chacune des 8 pages du dashboard appelait son propre
 * useBox(), donc 8 requêtes indépendantes vers box_members à chaque
 * navigation (flicker de loading + charge réseau inutile). Maintenant
 * le fetch a lieu une fois ici, et toutes les pages consomment le
 * même état via useContext — sans avoir à changer un seul de leurs
 * imports (useBox() garde exactement la même signature, cf.
 * lib/hooks/useBox.js qui ré-exporte simplement ce hook).
 */
export function BoxProvider({ children }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userId, setUserId] = useState(null)
  const [memberships, setMemberships] = useState([])
  const [activeBoxId, setActiveBoxId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }
    setUserId(user.id)

    const { data, error: fetchError } = await supabase
      .from('box_members')
      .select('box_id, role, status, boxes ( id, name, slug )')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (fetchError) {
      // Avant : console.error silencieux + spinner qui tourne à
      // l'infini. Maintenant l'erreur est exposée pour que l'UI
      // puisse l'afficher au lieu de bloquer l'utilisateur sans
      // explication.
      console.error(fetchError)
      setError(fetchError.message || 'Impossible de charger tes box.')
      setLoading(false)
      return
    }

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
    // Défense en profondeur : on ne bascule que vers une box dont on
    // est réellement membre actif (état déjà validé côté serveur),
    // jamais vers une valeur arbitraire passée par l'appelant.
    setMemberships(current => {
      const valid = current.some(m => m.box_id === boxId)
      if (valid) {
        setActiveBoxId(boxId)
        if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, boxId)
      }
      return current
    })
  }, [])

  const activeMembership = memberships.find(m => m.box_id === activeBoxId)
  const role = activeMembership?.role || 'member'
  const isCoach = role === 'coach'
  const activeBoxName = activeMembership?.boxes?.name || ''

  const value = {
    loading, error, userId, memberships, activeBoxId, activeBoxName,
    role, isCoach, switchBox, reload: load,
  }

  return <BoxContext.Provider value={value}>{children}</BoxContext.Provider>
}

export function useBoxContext() {
  const ctx = useContext(BoxContext)
  if (!ctx) {
    throw new Error('useBoxContext() doit être utilisé sous <BoxProvider> (voir app/dashboard/layout.js)')
  }
  return ctx
}
