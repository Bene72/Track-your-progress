'use client'
import { useEffect } from 'react'

// Fenêtre qui monte du bas de l'écran (mêmes classes .sheet que "Mes groupes",
// cf. components/GroupsSheet.js). Sert au calendrier complet, à la vue semaine
// et au formulaire d'ajout de bloc du détail d'un programme.
export default function BottomSheet({ open, onClose, title, subtitle, children }) {
  // Ferme sur Échap, comme les autres panneaux de l'app.
  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      <div className={`sheetOverlay ${open ? 'sheetOverlayOpen' : ''}`} onClick={onClose} />
      <div
        className={`sheet ${open ? 'sheetOpen' : ''}`}
        style={open ? undefined : { boxShadow: 'none' }}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-label={title}
      >
        <div className="sheetHandle" />
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            <h2 className="h2" style={{ fontSize: 20 }}>{title}</h2>
            {subtitle && <p className="muted" style={{ fontSize: 12, marginTop: 2 }}>{subtitle}</p>}
          </div>
          <button type="button" className="kebabBtn" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        {children}
      </div>
    </>
  )
}
