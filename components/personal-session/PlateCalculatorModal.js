'use client'
import { useState } from 'react'
import { calculatePlates } from '../../lib/fitness-math'

const BAR_PRESETS = [
  { label: 'Barre homme (20 kg)', value: 20 },
  { label: 'Barre femme (15 kg)', value: 15 },
  { label: 'Barre courte (10 kg)', value: 10 },
]

export default function PlateCalculatorModal({ initialWeight, onClose }) {
  const [target, setTarget] = useState(initialWeight ? String(initialWeight) : '')
  const [bar, setBar] = useState(20)

  const result = target ? calculatePlates(Number(target), bar) : null

  return (
    <div className="pcalc-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <style jsx>{`
        .pcalc-overlay { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 16px; background: rgba(0,0,0,.6); }
        .pcalc { width: 100%; max-width: 360px; border: 1px solid rgba(255,255,255,.12); border-radius: 18px; background: #17140F; padding: 18px; }
        .pcalc-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .pcalc-title { font-size: 15px; font-weight: 850; }
        .pcalc-close { border: 0; background: transparent; color: rgba(255,255,255,.5); font-size: 16px; cursor: pointer; }
        .pcalc-row { display: flex; gap: 8px; margin-bottom: 10px; }
        .pcalc-field { flex: 1; }
        .pcalc-label { display: block; margin-bottom: 4px; color: rgba(255,255,255,.5); font-size: 10px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
        .pcalc-input, .pcalc-select { width: 100%; box-sizing: border-box; min-height: 38px; padding: 0 10px; border: 1px solid rgba(255,255,255,.1); border-radius: 10px; color: white; background: rgba(255,255,255,.04); font: inherit; font-size: 13px; outline: none; }
        .pcalc-input:focus, .pcalc-select:focus { border-color: rgba(249,115,22,.6); }
        .pcalc-result { margin-top: 14px; padding: 14px; border-radius: 14px; background: rgba(249,115,22,.08); border: 1px solid rgba(249,115,22,.2); }
        .pcalc-per-side { font-size: 11px; font-weight: 800; color: #FDBA74; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 8px; }
        .pcalc-plates { display: flex; flex-wrap: wrap; gap: 6px; }
        .pcalc-plate { min-width: 40px; padding: 6px 8px; border-radius: 8px; background: rgba(255,255,255,.08); font-size: 12px; font-weight: 800; text-align: center; }
        .pcalc-remainder { margin-top: 8px; font-size: 11px; color: rgba(255,255,255,.5); }
        .pcalc-empty { padding: 12px; text-align: center; color: rgba(255,255,255,.45); font-size: 12px; }
      `}</style>
      <div className="pcalc" onClick={e => e.stopPropagation()}>
        <div className="pcalc-head">
          <div className="pcalc-title">🧮 Calculateur de plaques</div>
          <button className="pcalc-close" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <div className="pcalc-row">
          <div className="pcalc-field">
            <label className="pcalc-label">Poids total (kg)</label>
            <input className="pcalc-input" type="number" min="0" step="0.5" value={target}
              onChange={e => setTarget(e.target.value)} inputMode="decimal" autoFocus />
          </div>
          <div className="pcalc-field">
            <label className="pcalc-label">Barre</label>
            <select className="pcalc-select" value={bar} onChange={e => setBar(Number(e.target.value))}>
              {BAR_PRESETS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>
        </div>

        {target && !result && (
          <div className="pcalc-empty">Le poids total doit être ≥ au poids de la barre.</div>
        )}

        {result && (
          <div className="pcalc-result">
            <div className="pcalc-per-side">Par côté ({result.perSide.length} disque{result.perSide.length !== 1 ? 's' : ''})</div>
            {result.perSide.length === 0 ? (
              <div className="pcalc-empty" style={{ padding: 0 }}>Barre seule, rien à charger.</div>
            ) : (
              <div className="pcalc-plates">
                {result.perSide.map((p, i) => <span key={i} className="pcalc-plate">{p}</span>)}
              </div>
            )}
            {result.remainder > 0.01 && (
              <div className="pcalc-remainder">⚠ {result.remainder} kg par côté non chargeables avec ce jeu de disques.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
