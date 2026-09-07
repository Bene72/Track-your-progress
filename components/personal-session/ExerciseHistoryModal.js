'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

function formatDateFr(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

// Lit la vue public.personal_exercise_history (cf. supabase_migration_v2.sql),
// filtrée côté client par exercise_id — la RLS de sécurité invoker garantit
// déjà qu'on ne voit que ses propres logs.
export default function ExerciseHistoryModal({ exercise, userId, onClose }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('personal_exercise_history')
        .select('session_date, block_type, round_number, reps, weight_kg, distance_m, rpe')
        .eq('exercise_id', exercise.id)
        .eq('user_id', userId)
        .limit(30)
      if (cancelled) return
      if (fetchError) setError(fetchError.message || 'Impossible de charger l\'historique.')
      else setRows(data || [])
      setLoading(false)
    }
    if (exercise?.id && userId) load()
    return () => { cancelled = true }
  }, [exercise?.id, userId])

  // Regroupe les rounds par séance pour un affichage compact.
  const bySession = rows.reduce((acc, r) => {
    acc[r.session_date] = acc[r.session_date] || []
    acc[r.session_date].push(r)
    return acc
  }, {})

  return (
    <div className="hmodal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <style jsx>{`
        .hmodal-overlay { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 16px; background: rgba(0,0,0,.6); }
        .hmodal { width: 100%; max-width: 420px; max-height: 80vh; overflow-y: auto; border: 1px solid rgba(255,255,255,.12); border-radius: 18px; background: #17140F; padding: 18px; }
        .hmodal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .hmodal-title { font-size: 15px; font-weight: 850; }
        .hmodal-close { border: 0; background: transparent; color: rgba(255,255,255,.5); font-size: 16px; cursor: pointer; }
        .hmodal-session { margin-bottom: 12px; }
        .hmodal-date { font-size: 11px; font-weight: 800; color: #FDBA74; text-transform: capitalize; margin-bottom: 4px; }
        .hmodal-round { display: flex; gap: 8px; font-size: 12.5px; color: rgba(255,255,255,.85); padding: 3px 0; border-bottom: 1px dashed rgba(255,255,255,.06); }
        .hmodal-empty { padding: 24px 8px; text-align: center; color: rgba(255,255,255,.5); font-size: 13px; }
      `}</style>
      <div className="hmodal" onClick={e => e.stopPropagation()}>
        <div className="hmodal-head">
          <div className="hmodal-title">Historique — {exercise?.name}</div>
          <button className="hmodal-close" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        {loading && <div className="hmodal-empty">Chargement…</div>}
        {error && <div className="hmodal-empty">{error}</div>}
        {!loading && !error && Object.keys(bySession).length === 0 && (
          <div className="hmodal-empty">Aucune séance précédente sur ce mouvement.</div>
        )}

        {Object.entries(bySession).map(([date, roundsForDate]) => (
          <div className="hmodal-session" key={date}>
            <div className="hmodal-date">{formatDateFr(date)}</div>
            {roundsForDate.map((r, i) => (
              <div className="hmodal-round" key={i}>
                <span>Round {r.round_number}</span>
                {r.reps != null && <span>· {r.reps} reps</span>}
                {r.weight_kg != null && <span>· {r.weight_kg} kg</span>}
                {r.distance_m != null && <span>· {r.distance_m} m</span>}
                {r.rpe != null && <span>· RPE {r.rpe}</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
