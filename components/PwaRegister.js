'use client'
import { useEffect } from 'react'

// Enregistre le service worker côté client uniquement. À monter une seule
// fois dans le layout racine — voir app/layout.js.
export default function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('Échec enregistrement service worker:', err)
      })
    }
  }, [])
  return null
}
