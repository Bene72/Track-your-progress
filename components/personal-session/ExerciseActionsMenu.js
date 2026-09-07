'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ExerciseHistoryModal from './ExerciseHistoryModal'
import ExerciseNoteModal from './ExerciseNoteModal'
import PlateCalculatorModal from './PlateCalculatorModal'

// Menu "⋮" affiché sur chaque mouvement d'un bloc de séance perso, calqué
// sur le menu "Voir la vidéo / Historique / PRs" de la capture fournie
// (app FORGED), complété par une note persistante et un calculateur de
// plaques. Volontairement autonome (pas de prop drilling supplémentaire) :
// il ne prend que l'exercice concerné + l'utilisateur courant.
export default function ExerciseActionsMenu({ exercise, userId, lastWeightKg, onNoteChange }) {
  const [open, setOpen] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showNote, setShowNote] = useState(false)
  const [showPlates, setShowPlates] = useState(false)
  const ref = useRef(null)
  const router = useRouter()

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const hasVideo = Boolean(exercise?.video_url)

  const handleVideo = () => {
    setOpen(false)
    if (hasVideo) window.open(exercise.video_url, '_blank', 'noopener,noreferrer')
  }

  const handleHistory = () => {
    setOpen(false)
    setShowHistory(true)
  }

  const handlePrs = () => {
    setOpen(false)
    router.push(`/dashboard/pr?movement=${encodeURIComponent(exercise?.name || '')}`)
  }

  const handleNote = () => {
    setOpen(false)
    setShowNote(true)
  }

  const handlePlates = () => {
    setOpen(false)
    setShowPlates(true)
  }

  return (
    <div className="exmenu" ref={ref}>
      <style jsx>{`
        .exmenu { position: relative; }
        .exmenu-trigger { width: 28px; height: 28px; border: 1px solid rgba(255,255,255,.1); border-radius: 8px; color: rgba(255,255,255,.6); background: rgba(255,255,255,.03); font-size: 14px; line-height: 1; cursor: pointer; }
        .exmenu-trigger:hover { color: white; border-color: rgba(249,115,22,.4); }
        .exmenu-panel { position: absolute; top: 32px; right: 0; z-index: 20; min-width: 190px; padding: 6px; border: 1px solid rgba(255,255,255,.12); border-radius: 12px; background: #17140F; box-shadow: 0 12px 30px rgba(0,0,0,.45); }
        .exmenu-item { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 36px; padding: 0 10px; border: 0; border-radius: 8px; color: rgba(255,255,255,.85); background: transparent; font: inherit; font-size: 12.5px; font-weight: 700; text-align: left; cursor: pointer; }
        .exmenu-item:hover { background: rgba(249,115,22,.12); color: #FDBA74; }
        .exmenu-item:disabled { opacity: .4; cursor: not-allowed; }
        .exmenu-item:disabled:hover { background: transparent; color: rgba(255,255,255,.85); }
        .exmenu-sep { height: 1px; margin: 4px 6px; background: rgba(255,255,255,.08); }
      `}</style>

      <button type="button" className="exmenu-trigger" onClick={() => setOpen(o => !o)} aria-label="Actions du mouvement">⋮</button>

      {open && (
        <div className="exmenu-panel" role="menu">
          <button type="button" className="exmenu-item" role="menuitem" onClick={handleVideo} disabled={!hasVideo}>
            🎥 Voir la vidéo
          </button>
          <button type="button" className="exmenu-item" role="menuitem" onClick={handleHistory}>
            🕘 Historique
          </button>
          <button type="button" className="exmenu-item" role="menuitem" onClick={handlePrs}>
            🏆 PRs
          </button>
          <div className="exmenu-sep" />
          <button type="button" className="exmenu-item" role="menuitem" onClick={handleNote}>
            📝 Note du mouvement
          </button>
          <button type="button" className="exmenu-item" role="menuitem" onClick={handlePlates}>
            🧮 Calculateur de plaques
          </button>
        </div>
      )}

      {showHistory && (
        <ExerciseHistoryModal exercise={exercise} userId={userId} onClose={() => setShowHistory(false)} />
      )}

      {showNote && (
        <ExerciseNoteModal
          exercise={exercise}
          userId={userId}
          onClose={(savedNote) => {
            setShowNote(false)
            if (savedNote !== null && onNoteChange) onNoteChange(savedNote)
          }}
        />
      )}

      {showPlates && (
        <PlateCalculatorModal initialWeight={lastWeightKg} onClose={() => setShowPlates(false)} />
      )}
    </div>
  )
}

