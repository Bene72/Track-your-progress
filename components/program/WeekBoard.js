'use client'
import { computeSessionDate, weekdayShort, dayOfMonth } from '../../lib/program-date'
import { athleteLog } from '../../lib/program-progress'
import { getBlockType } from '../../lib/blockTypes'
import { feelingFace } from './DayFeeling'

const PERIOD_LABELS = { AM: 'Matin', PM: 'Soir', unique: 'Séance' }

// Vue semaine en colonnes (grand écran) : les 7 jours côte à côte, chaque bloc
// teinté de la couleur de son type, avec le tag « Optionnel », la coche « fait »
// et le ressenti du jour. Un clic sur une colonne ouvre ce jour en détail
// (modification, saisie des résultats…).
export default function WeekBoard({ startDate, weekNumber, week, athleteId, selectedKey, todayKey, feelings, onPick }) {
  return (
    <div className="wb">
      {Array.from({ length: 7 }, (_, offset) => {
        const key = computeSessionDate(startDate, weekNumber, offset)
        const sessions = (week?.sessions || []).filter(s => s.day_offset === offset)
        const feeling = feelings?.[key]
        const face = feelingFace(feeling?.rating)
        const isToday = key === todayKey
        const isPast = key <= todayKey
        return (
          <section
            key={key}
            className={`wbCol ${isToday ? 'wbToday' : ''} ${key === selectedKey ? 'wbSel' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={`Ouvrir le ${weekdayShort(key)} ${dayOfMonth(key)}`}
            onClick={() => onPick(key)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(key) } }}
          >
            <header className="wbHead">
              <b>{weekdayShort(key)} {dayOfMonth(key)}</b>
              {isToday && <span className="wbTag">Aujourd’hui</span>}
            </header>

            {sessions.length > 0 && (isPast || face) && (
              <div className="wbFeel" title={feeling?.comment || ''}>
                <span>Ressenti</span>
                <i>{face ? `${face.face} ${face.rating}/5` : '—'}</i>
              </div>
            )}

            {sessions.length === 0 && <div className="wbRest">Repos</div>}

            {sessions.map(s => (
              <div key={s.id} className="wbSession">
                {(sessions.length > 1 || s.period !== 'unique') && <em>{PERIOD_LABELS[s.period] || s.period}</em>}
                {s.blocks.length === 0 && <span className="wbRest">Séance vide</span>}
                {s.blocks.map((b, i) => {
                  const type = getBlockType(b.block_type)
                  const done = athleteLog(b, athleteId)?.status === 'done'
                  return (
                    <article
                      key={b.id}
                      className="wbBlock"
                      style={{ background: `${type.color}1f`, borderLeft: `3px solid ${type.color}` }}
                    >
                      <h4>
                        <span className="wbLetter">{String.fromCharCode(65 + i)}</span>
                        <span>{type.icon}</span>
                        <span className="wbTitle">{b.title}</span>
                        {done && <span className="wbDone" aria-label="Fait">✓</span>}
                      </h4>
                      {b.prescription && <p>{b.prescription}</p>}
                      {b.is_optional && <span className="wbOpt">Optionnel</span>}
                    </article>
                  )
                })}
              </div>
            ))}
          </section>
        )
      })}
      <style jsx>{`
        .wb { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 10px; align-items: start; }
        .wbCol {
          display: flex; flex-direction: column; gap: 8px; min-height: 260px; padding: 10px; cursor: pointer;
          background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; outline: none;
        }
        .wbCol:hover { border-color: var(--border-hi); }
        .wbCol:focus-visible { border-color: var(--accent); }
        .wbToday { border-color: var(--accent-brd); }
        .wbSel { border-color: var(--accent); }
        .wbHead { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; }
        .wbHead b { font-size: 14px; }
        .wbTag { font-size: 11px; font-weight: 700; color: var(--accent); }
        .wbFeel {
          display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 5px 8px;
          border-radius: 9px; background: var(--bg-card-2); font-size: 11px; color: var(--chalk-muted);
        }
        .wbFeel i { font-style: normal; font-weight: 700; color: var(--chalk); }
        .wbSession { display: flex; flex-direction: column; gap: 6px; }
        .wbSession em { font-style: normal; font-size: 11px; font-weight: 700; color: var(--accent); }
        .wbRest { margin: auto; font-size: 12px; color: var(--chalk-muted); }
        .wbBlock { padding: 8px 9px; border-radius: 10px; }
        .wbBlock h4 { display: flex; align-items: center; gap: 5px; margin: 0; font-size: 12.5px; line-height: 1.25; }
        .wbLetter { flex: none; font-weight: 800; color: var(--chalk-muted); }
        .wbTitle { flex: 1; min-width: 0; overflow-wrap: anywhere; }
        .wbDone { flex: none; color: var(--rx); font-weight: 800; }
        .wbBlock p {
          margin: 3px 0 0; font-size: 11.5px; color: var(--chalk-dim); white-space: pre-line;
          display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
        }
        .wbOpt { display: inline-block; margin-top: 5px; padding: 0 7px; border: 1px dashed var(--chalk-muted); border-radius: 8px; font-size: 10.5px; color: var(--chalk-dim); }
      `}</style>
    </div>
  )
}
