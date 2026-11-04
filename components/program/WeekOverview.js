'use client'
import { computeSessionDate, weekdayShort, dayOfMonth } from '../../lib/program-date'
import { athleteLog } from '../../lib/program-progress'
import { getBlockType } from '../../lib/blockTypes'

const PERIOD_SHORT = { AM: 'AM', PM: 'PM', unique: 'Séance' }

// "Vue semaine" : les 7 jours d'un coup avec, pour chaque séance, la liste de
// ses blocs (A · titre). Un tap sur un jour y amène directement.
export default function WeekOverview({ startDate, weekNumber, week, athleteId, selectedKey, todayKey, onPick }) {
  return (
    <div className="stack" style={{ gap: 6 }}>
      {Array.from({ length: 7 }, (_, offset) => {
        const key = computeSessionDate(startDate, weekNumber, offset)
        const sessions = (week?.sessions || []).filter(s => s.day_offset === offset)
        const active = key === selectedKey
        return (
          <button key={key} type="button" className={`wo ${active ? 'woActive' : ''}`} onClick={() => onPick(key)}>
            <span className="woDay">
              <small className={key === todayKey ? 'woToday' : ''}>{weekdayShort(key)}</small>
              <b>{dayOfMonth(key)}</b>
            </span>
            <span className="woBody">
              {sessions.length === 0 && <span className="woRest">Repos</span>}
              {sessions.map(s => (
                <span key={s.id} className="woSession">
                  {(sessions.length > 1 || s.period !== 'unique') && <em>{PERIOD_SHORT[s.period] || s.period}</em>}
                  {s.blocks.length === 0 && <span className="woRest">Séance vide</span>}
                  {s.blocks.map((b, i) => (
                    <span key={b.id} className="woBlock">
                      <span className="woLetter">{String.fromCharCode(65 + i)}</span>
                      <span className="woIcon">{getBlockType(b.block_type).icon}</span>
                      <span className="woTitle">{b.title}</span>
                      {athleteLog(b, athleteId)?.status === 'done' && <span className="woDone">✓</span>}
                    </span>
                  ))}
                </span>
              ))}
            </span>
          </button>
        )
      })}
      <style jsx>{`
        .wo {
          display: flex; gap: 12px; align-items: flex-start; width: 100%; text-align: left;
          padding: 10px 12px; border-radius: 12px; border: 1px solid var(--border);
          background: var(--bg-card-2); color: var(--chalk); font: inherit; cursor: pointer;
        }
        .woActive { border-color: var(--accent-brd); background: var(--accent-dim); }
        .woDay { width: 34px; flex: none; text-align: center; }
        .woDay small { display: block; font-size: 10px; font-weight: 700; letter-spacing: .04em; color: var(--chalk-muted); }
        .woDay small.woToday { color: var(--accent); }
        .woDay b { display: block; font-size: 15px; margin-top: 2px; }
        .woBody { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
        .woSession { display: flex; flex-direction: column; gap: 3px; }
        .woSession em { font-style: normal; font-size: 10px; font-weight: 800; letter-spacing: .08em; color: var(--accent); }
        .woRest { font-size: 12px; color: var(--chalk-muted); }
        .woBlock { display: flex; align-items: center; gap: 6px; font-size: 13px; min-width: 0; }
        .woLetter { flex: none; width: 16px; font-size: 11px; font-weight: 800; color: var(--chalk-muted); }
        .woIcon { flex: none; font-size: 13px; }
        .woTitle { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--chalk-dim); }
        .woDone { flex: none; color: var(--rx); font-weight: 800; }
      `}</style>
    </div>
  )
}
