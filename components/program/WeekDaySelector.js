'use client'
import { computeSessionDate, weekdayShort, dayOfMonth } from '../../lib/program-date'
import { sessionProgress } from '../../lib/program-progress'

// Les 7 jours de la semaine affichée, sur une seule ligne : libellé, numéro,
// un point par séance programmée (vert quand tous ses blocs sont faits) et
// le jour sélectionné mis en évidence. Changer de jour = un seul tap.
export default function WeekDaySelector({ startDate, weekNumber, week, athleteId, selectedKey, todayKey, onSelect }) {
  const days = Array.from({ length: 7 }, (_, offset) => {
    const key = computeSessionDate(startDate, weekNumber, offset)
    const sessions = (week?.sessions || []).filter(s => s.day_offset === offset)
    return {
      key,
      label: weekdayShort(key),
      num: dayOfMonth(key),
      dots: sessions.map(s => {
        const { total, done } = sessionProgress(s, athleteId)
        return total > 0 && done >= total ? 'done' : 'todo'
      }),
    }
  })

  return (
    <nav className="wds" aria-label="Jours de la semaine">
      {days.map(d => {
        const active = d.key === selectedKey
        const today = d.key === todayKey
        return (
          <button
            key={d.key}
            type="button"
            className={`wdsDay ${active ? 'wdsActive' : ''} ${today ? 'wdsToday' : ''}`}
            onClick={() => onSelect(d.key)}
            aria-pressed={active}
          >
            <small>{d.label}</small>
            <b>{d.num}</b>
            <span className="wdsDots">
              {d.dots.map((state, i) => (
                <i key={i} className={`wdsDot ${state === 'done' ? 'wdsDotDone' : ''}`} />
              ))}
            </span>
          </button>
        )
      })}
      <style jsx>{`
        .wds { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; }
        .wdsDay {
          min-width: 0; padding: 8px 1px 7px; text-align: center; border-radius: 11px;
          border: 1px solid transparent; background: transparent; color: var(--chalk-muted);
          font: inherit; cursor: pointer;
        }
        .wdsDay small { display: block; font-size: 10px; font-weight: 700; letter-spacing: .04em; }
        .wdsDay b { display: block; margin-top: 3px; font-size: 14px; color: var(--chalk); }
        .wdsToday small { color: var(--accent); }
        .wdsActive { background: var(--accent-dim); border-color: var(--accent-brd); }
        .wdsActive small { color: var(--accent); }
        .wdsDots { display: flex; justify-content: center; gap: 3px; height: 4px; margin-top: 5px; }
        .wdsDot { display: block; width: 4px; height: 4px; border-radius: 50%; background: var(--chalk-muted); }
        .wdsActive .wdsDot { background: var(--accent); }
        .wdsDotDone, .wdsActive .wdsDotDone { background: var(--rx); }
      `}</style>
    </nav>
  )
}
