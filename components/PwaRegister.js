'use client'

import { useEffect } from 'react'

export default function PwaRegister() {
  useEffect(() => {
    if (!window.isSecureContext || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // L'application reste utilisable sans PWA ; ne pas exposer l'erreur interne.
    })
  }, [])
  return null
}
