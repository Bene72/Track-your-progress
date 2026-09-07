'use client'
import { useState, useEffect } from 'react'
import { useAthlete1RM } from '../../lib/hooks/usePrograms'
import { calculatePlates } from '../../lib/fitness-math'

const BAR_PRESETS = [
  { label: 'Barre 20 kg', value: 20 },
  { label: 'Barre 15 kg', value: 15 },
]

// Affiché sous un bloc de programme quand le coach a prescrit un %1RM ET
// que le bloc est lié à un mouvement du catalogue. Va chercher le dernier
// PR (poids) de l'athlète sur ce mouvement et calcule la charge de travail,
// arrondie aux plus petits disques disponibles, avec la décomposition par
// côté (réutilise lib/fitness-math.js, déjà utilisé par le calculateur de
// plaques de Perso).
export default function AutoLoadPanel({ athleteId, canEditRM, exerciseName, percent }) {
  const { oneRM, loading, updateOneRM } = useAthlete1RM(athleteId, exerciseName)
  const [manualRM, setManualRM] = useState('')
  const [bar, setBar] = useState(20)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (oneRM?.value_number != null) setManualRM(String(oneRM.value_number))
  }, [oneRM])

  if (loading) return <p className="muted" style={{ fontSize: 11.5 }}>Recherche du 1RM sur {exerciseName}…</p>

  if (!oneRM && !manualRM) {
    return (
      <div className="alp-empty">
        <style jsx>{`.alp-empty { margin-top: 8px; padding: 8px 10px; border-radius: 10px; background: rgba(232,179,71,.08); border: 1px solid rgba(232,179,71,.2); font-size: 11px; color: #E8B347; }`}</style>
          {canEditRM
            ? <>Aucun 1RM enregistré pour <b>{exerciseName}</b>. Ajoute-en un dans Mes PR pour voir la charge calculée automatiquement pour ce bloc (prescrit à {percent}%).</>
            : <>L&apos;athlète n&apos;a pas encore de 1RM enregistré pour <b>{exerciseName}</b> — la charge ne peut pas être calculée pour l&apos;instant.</>}
      </div>
    )
  }

  const rmValue = parseFloat(manualRM) || 0
  let weight = (rmValue * percent) / 100
  weight = Math.round(weight / 1.25) * 1.25
  const plates = calculatePlates(weight, bar)

  const handleSaveRM = async () => {
    setSaving(true)
    try {
      await updateOneRM(rmValue)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="alp">
      <style jsx>{`
        .alp { margin-top: 8px; padding: 12px; border-radius: 12px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08); }
        .alp-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
        .alp-label { font-size: 10px; color: rgba(255,255,255,.45); font-weight: 800; text-transform: uppercase; letter-spacing: .05em; }
        .alp-input { width: 60px; text-align: right; font-family: var(--font-mono, monospace); font-size: 12.5px; box-sizing: border-box; padding: 4px 6px; border: 1px solid rgba(255,255,255,.12); border-radius: 7px; color: white; background: rgba(255,255,255,.04); }
        .alp-select { font-size: 11px; padding: 4px 6px; border-radius: 7px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.04); color: white; }
        .alp-save { font-size: 10.5px; font-weight: 700; color: #FDBA74; background: transparent; border: none; cursor: pointer; }
        .alp-result { text-align: center; padding: 10px 0 6px; }
        .alp-result-value { font-size: 30px; font-weight: 800; color: #FDBA74; line-height: 1; }
        .alp-result-label { font-size: 10px; color: rgba(255,255,255,.4); text-transform: uppercase; letter-spacing: .05em; margin-top: 3px; }
        .alp-plates-label { font-size: 10px; color: rgba(255,255,255,.4); font-weight: 700; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 6px; }
        .alp-plates { display: flex; gap: 5px; flex-wrap: wrap; }
        .alp-plate { min-width: 32px; padding: 4px 6px; border-radius: 6px; background: rgba(232,179,71,.12); color: #E8B347; font-family: var(--font-mono, monospace); font-size: 10.5px; font-weight: 700; text-align: center; }
      `}</style>

      <div className="alp-row">
        <span className="alp-label">1RM {exerciseName}{canEditRM ? ' (le tien)' : ' (athlète)'}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {canEditRM ? (
            <input className="alp-input" type="number" step="0.5" value={manualRM} onChange={e => setManualRM(e.target.value)} />
          ) : (
            <span className="alp-input" style={{ border: 'none', background: 'transparent' }}>{manualRM}</span>
          )}
          kg
        </div>
      </div>
      {canEditRM && rmValue !== oneRM?.value_number && rmValue > 0 && (
        <div className="alp-row" style={{ marginTop: -4 }}>
          <span />
          <button type="button" className="alp-save" onClick={handleSaveRM} disabled={saving}>
            {saved ? '✓ Enregistré' : saving ? '...' : 'Enregistrer comme nouveau PR'}
          </button>
        </div>
      )}
      <div className="alp-row">
        <span className="alp-label">Barre</span>
        <select className="alp-select" value={bar} onChange={e => setBar(Number(e.target.value))}>
          {BAR_PRESETS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
      </div>

      <div className="alp-result">
        <div className="alp-result-value">{weight} kg</div>
        <div className="alp-result-label">{percent}% de {rmValue} kg — arrondi aux 1,25 kg</div>
      </div>

      {plates && (
        <>
          <div className="alp-plates-label">Disques par côté</div>
          <div className="alp-plates">
            {plates.perSide.length === 0
              ? <span className="muted" style={{ fontSize: 11 }}>Barre seule</span>
              : plates.perSide.map((p, i) => <span key={i} className="alp-plate">{p}</span>)}
          </div>
        </>
      )}
    </div>
  )
}
