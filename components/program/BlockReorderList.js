'use client'
import { useState, useRef, useEffect } from 'react'
import { getBlockType } from '../../lib/blockTypes'
import { moveInOrder } from '../../lib/program-reorder'

// Mode "Réorganiser" d'une séance : les blocs deviennent des lignes compactes
// qu'on attrape directement (doigt ou souris) pour les glisser vers le haut ou
// le bas. Les lettres A, B, C… dérivent de la position : elles se mettent à
// jour en direct pendant le glissement.
//
// - Pointer Events : un seul code pour la souris et le tactile, sans dépendance
//   (l'API drag & drop HTML ne fonctionne pas au tactile).
// - Pendant un glissement, l'ordre du DOM ne change PAS (déplacer le nœud qui
//   détient la capture du pointeur la ferait perdre) : la ligne tirée suit le
//   doigt via translateY et les lignes qu'elle enjambe se décalent d'une hauteur.
// - Près du haut / du bas de l'écran, la page défile toute seule (séances longues).
// - Clavier (accessibilité) : ligne sélectionnée + flèches ↑ ↓.
const GAP = 8
const EDGE_TOP = 120     // px depuis le haut de l'écran (sous la barre du haut)
const EDGE_BOTTOM = 150  // px depuis le bas (au-dessus de la barre d'actions)
const MAX_SCROLL = 10    // px par image

// Conteneur qui défile réellement. Dans BoxLog, `html, body { height: 100%;
// overflow-x: hidden }` fait de <body> le conteneur de défilement (le défilement
// de la fenêtre reste à 0) : on remonte donc les parents jusqu'au premier
// élément scrollable, avec document.scrollingElement en repli.
function findScroller(el) {
  let node = el.parentElement
  while (node && node !== document.documentElement) {
    const oy = getComputedStyle(node).overflowY
    if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) return node
    node = node.parentElement
  }
  return document.scrollingElement || document.documentElement
}

export default function BlockReorderList({ blocks, onReorder }) {
  const [order, setOrder] = useState(() => blocks.map(b => b.id))
  const [drag, setDrag] = useState(null) // { id, dy, target } pendant un glissement
  const [error, setError] = useState(null)
  const rowRefs = useRef({})
  const dragRef = useRef(null)

  const byId = Object.fromEntries(blocks.map(b => [b.id, b]))

  // Resynchronise avec les blocs du parent (ajout, suppression, rollback),
  // sauf pendant un glissement.
  useEffect(() => {
    if (!dragRef.current) setOrder(blocks.map(b => b.id))
  }, [blocks])

  // Arrête la boucle de défilement si le composant disparaît en plein glissement.
  useEffect(() => () => {
    if (dragRef.current?.raf) cancelAnimationFrame(dragRef.current.raf)
  }, [])

  const persist = async (nextOrder) => {
    setError(null)
    try {
      await onReorder(nextOrder)
    } catch (err) {
      setError(err.message)
      setOrder(blocks.map(b => b.id))
    }
  }

  // ─── Glisser-déposer ───

  // Recalcule le décalage et le nouvel index à partir de la position du pointeur.
  const update = (clientY) => {
    const d = dragRef.current
    if (!d) return
    const dy = clientY + d.scroller.scrollTop - d.startY
    const me = d.rects[d.id]
    const center = me.top + dy + me.h / 2
    // Nouvel index = nombre des AUTRES lignes dont le centre (position de
    // départ) est au-dessus du centre de la ligne tirée.
    let target = 0
    for (const rid of d.order0) {
      if (rid === d.id) continue
      const r = d.rects[rid]
      if (r.top + r.h / 2 < center) target += 1
    }
    d.target = target
    setDrag({ id: d.id, dy, target })
  }

  // Défilement automatique de la page quand on approche du bord de l'écran.
  const autoScroll = () => {
    const d = dragRef.current
    if (!d) return
    const vh = window.innerHeight
    let speed = 0
    if (d.lastY < EDGE_TOP) speed = -MAX_SCROLL * Math.min(1, (EDGE_TOP - d.lastY) / EDGE_TOP)
    else if (d.lastY > vh - EDGE_BOTTOM) speed = MAX_SCROLL * Math.min(1, (d.lastY - (vh - EDGE_BOTTOM)) / EDGE_BOTTOM)
    if (speed !== 0) {
      const before = d.scroller.scrollTop
      d.scroller.scrollTop = before + speed
      if (d.scroller.scrollTop !== before) update(d.lastY)
    }
    d.raf = requestAnimationFrame(autoScroll)
  }

  const onPointerDown = (e, id) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const scroller = findScroller(e.currentTarget)
    const rects = {}
    for (const rid of order) {
      const r = rowRefs.current[rid].getBoundingClientRect()
      rects[rid] = { top: r.top + scroller.scrollTop, h: r.height }
    }
    dragRef.current = {
      id, rects, scroller, order0: [...order], target: order.indexOf(id),
      startY: e.clientY + scroller.scrollTop, lastY: e.clientY, raf: 0,
    }
    setDrag({ id, dy: 0, target: order.indexOf(id) })
    dragRef.current.raf = requestAnimationFrame(autoScroll)
  }

  const onPointerMove = (e) => {
    const d = dragRef.current
    if (!d) return
    d.lastY = e.clientY
    update(e.clientY)
  }

  const endDrag = (cancelled) => {
    const d = dragRef.current
    if (!d) return
    if (d.raf) cancelAnimationFrame(d.raf)
    dragRef.current = null
    setDrag(null)
    if (cancelled) return
    const from = d.order0.indexOf(d.id)
    if (d.target === from) return // simple clic : rien à enregistrer
    const next = moveInOrder(d.order0, from, d.target)
    setOrder(next)
    persist(next)
  }

  const onKeyDown = (e, id) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const from = order.indexOf(id)
    const next = moveInOrder(order, from, from + (e.key === 'ArrowUp' ? -1 : 1))
    if (next === order) return
    setOrder(next)
    persist(next)
  }

  // Décalage visuel d'une ligne non tirée pendant le glissement.
  const shiftOf = (index) => {
    if (!drag || !dragRef.current) return 0
    const from = order.indexOf(drag.id)
    const shift = dragRef.current.rects[drag.id].h + GAP
    if (from < drag.target && index > from && index <= drag.target) return -shift
    if (from > drag.target && index >= drag.target && index < from) return shift
    return 0
  }

  // Index visuel (donc lettre) d'une ligne pendant le glissement.
  const visualIndex = (id, index) => {
    if (!drag) return index
    const from = order.indexOf(drag.id)
    if (id === drag.id) return drag.target
    if (from < drag.target && index > from && index <= drag.target) return index - 1
    if (from > drag.target && index >= drag.target && index < from) return index + 1
    return index
  }

  return (
    <div className="brl">
      <p className="brlHint">
        Attrape un bloc et glisse-le vers le haut ou le bas. Les lettres A, B, C… suivent l&apos;ordre.
      </p>

      <div className="brlList">
        {order.map((id, index) => {
          const block = byId[id]
          if (!block) return null
          const type = getBlockType(block.block_type)
          const dragging = drag?.id === id
          const style = dragging
            ? { transform: `translateY(${drag.dy}px)`, zIndex: 5 }
            : { transform: `translateY(${shiftOf(index)}px)`, transition: drag ? 'transform .15s ease' : 'none' }
          return (
            <div
              key={id}
              ref={el => { rowRefs.current[id] = el }}
              className={`brlRow ${dragging ? 'brlDragging' : ''}`}
              style={style}
              role="button"
              tabIndex={0}
              aria-label={`${block.title} : déplacer avec les flèches haut et bas`}
              onPointerDown={e => onPointerDown(e, id)}
              onPointerMove={onPointerMove}
              onPointerUp={() => endDrag(false)}
              onPointerCancel={() => endDrag(true)}
              onKeyDown={e => onKeyDown(e, id)}
            >
              <span className="brlGrip" aria-hidden="true">⠿</span>
              <span className="brlLetter">{String.fromCharCode(65 + visualIndex(id, index))}</span>
              <span className="brlIcon">{type.icon}</span>
              <span className="brlText">
                <span className="brlTitle">{block.title}</span>
                {block.prescription && <span className="brlSub">{block.prescription.split('\n')[0]}</span>}
              </span>
            </div>
          )
        })}
      </div>

      {error && <div className="errorBox" style={{ marginTop: 8 }}>{error}</div>}

      <style jsx>{`
        .brl { display: flex; flex-direction: column; gap: 8px; }
        .brlHint { font-size: 12px; color: var(--chalk-muted); }
        .brlList { display: flex; flex-direction: column; gap: 8px; }
        .brlRow {
          position: relative; display: flex; align-items: center; gap: 10px; padding: 14px 14px 14px 10px;
          background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px;
          cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none;
          -webkit-touch-callout: none; outline: none;
        }
        .brlRow:focus-visible { border-color: var(--accent-brd); }
        .brlDragging { cursor: grabbing; border-color: var(--accent); box-shadow: 0 10px 28px rgba(0,0,0,.5); background: var(--bg-card-2); }
        .brlGrip { flex: none; width: 22px; text-align: center; font-size: 20px; color: var(--chalk-muted); }
        .brlDragging .brlGrip { color: var(--accent); }
        .brlLetter { flex: none; width: 18px; font-weight: 800; font-size: 15px; color: var(--accent); text-align: center; }
        .brlIcon { flex: none; font-size: 16px; }
        .brlText { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .brlTitle { font-size: 14px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .brlSub { font-size: 12px; color: var(--chalk-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      `}</style>
    </div>
  )
}
