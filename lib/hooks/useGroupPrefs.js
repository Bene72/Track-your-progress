'use client'
import { useState, useEffect, useCallback } from 'react'

// Quels "groupes" (WOD de box / Perso / chaque programme) l'athlète veut
// voir sur "Aujourd'hui" et le Calendrier. Stocké en localStorage, par
// utilisateur, par appareil — pas besoin de migration Supabase pour ça, et
// ça reste cohérent avec le modèle actuel où un athlète peut déjà avoir
// plusieurs programmes en parallèle (fetchMyPrograms ne filtre pas sur un
// seul "actif"). Tout ce qui n'a pas encore de préférence enregistrée est
// visible par défaut (opt-out, pas opt-in) pour ne rien cacher par surprise
// à la première visite.
function storageKey(userId) {
  return `boxlog:groupPrefs:${userId}`
}

function readPrefs(userId) {
  if (typeof window === 'undefined' || !userId) return {}
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function useGroupPrefs(userId) {
  const [prefs, setPrefs] = useState({})

  useEffect(() => {
    setPrefs(readPrefs(userId))
  }, [userId])

  const isVisible = useCallback((key) => prefs[key] !== false, [prefs])

  const setVisible = useCallback((key, visible) => {
    if (!userId) return
    setPrefs(prev => {
      const next = { ...prev, [key]: visible }
      try { window.localStorage.setItem(storageKey(userId), JSON.stringify(next)) } catch {}
      return next
    })
  }, [userId])

  const toggle = useCallback((key) => {
    setVisible(key, !isVisible(key))
  }, [isVisible, setVisible])

  return { isVisible, setVisible, toggle }
}
