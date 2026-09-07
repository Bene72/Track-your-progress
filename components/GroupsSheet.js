'use client'
import { useEffect, useRef } from 'react'

const STATUS_LABELS = { draft: 'Brouillon', active: 'Actif', completed: 'Terminé', archived: 'Archivé' }

export default function GroupsSheet({ open, onClose, myPrograms, prefs }) {
  const sheetRef = useRef(null)

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
      <div className={`sheet ${open ? 'sheetOpen' : ''}`} ref={sheetRef}>
        <div className="sheetHandle" />
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 className="h2" style={{ fontSize: 20 }}>Mes groupes</h2>
          <button type="button" className="kebabBtn" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <div className="eyebrow">Box</div>
        <ToggleRow label="WOD de box" dotColor="var(--rx)" checked={prefs.isVisible('wod')} onChange={v => prefs.setVisible('wod', v)} />
        <ToggleRow label="Perso" dotColor="var(--gold)" checked={prefs.isVisible('perso')} onChange={v => prefs.setVisible('perso', v)} />

        {myPrograms.length > 0 && (
          <>
            <div className="eyebrow" style={{ marginTop: 16 }}>Mes programmes</div>
            {myPrograms.map(p => (
              <ToggleRow
                key={p.id}
                label={p.name}
                sub={STATUS_LABELS[p.status]}
                dotColor="var(--accent)"
                checked={prefs.isVisible(`program:${p.id}`)}
                onChange={v => prefs.setVisible(`program:${p.id}`, v)}
              />
            ))}
          </>
        )}

        <p className="muted" style={{ fontSize: 11.5, marginTop: 14, lineHeight: 1.5 }}>
          Décoche un groupe pour le masquer d&apos;Aujourd&apos;hui et du Calendrier — pratique si tu suis plusieurs programmes en même temps et veux n&apos;en voir qu&apos;un à la fois. Ce choix reste sur cet appareil.
        </p>
      </div>
    </>
  )
}

function ToggleRow({ label, sub, dotColor, checked, onChange }) {
  return (
    <button type="button" className="toggleRow" onClick={() => onChange(!checked)}>
      <span className="toggleLeft">
        <span className="toggleDot" style={{ background: dotColor }} />
        <span>
          {label}
          {sub && <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}> — {sub}</span>}
        </span>
      </span>
      <span className={`switch ${checked ? 'switchOn' : ''}`} />
    </button>
  )
}
