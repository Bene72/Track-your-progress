'use client'
import { useState, useEffect, useRef } from 'react'
import { normalizeText } from './helpers'

// Champ de saisie libre avec suggestions filtrées en direct (ex: "fe" trouve
// "Fentes avant", "Fentes bulgares", "Développé Arnold"... peu importe où la
// sous-chaîne apparaît dans le nom). Remplace le <select> classique.
//
// Si le texte tapé ne correspond à AUCUN exercice existant, une option
// "＋ Créer « ... »" apparaît en bas de la liste : cliquer dessus crée
// l'exercice à la volée (via onCreateNew, fourni par le parent) puis le
// sélectionne directement. Ça évite de bloquer la saisie quand l'exercice
// voulu n'est pas encore dans le catalogue (base de données).
export default function ExerciseAutocomplete({ catalog, value, onChange, placeholder, onCreateNew }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!value) return
    const ex = catalog.find(e => e.id === value)
    if (ex) setQuery(ex.name)
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const trimmed = query.trim()
  const filtered = trimmed
    ? catalog.filter(ex => normalizeText(ex.name).includes(normalizeText(trimmed))).slice(0, 40)
    : catalog.slice(0, 40)
  const exactMatch = trimmed && catalog.some(ex => normalizeText(ex.name) === normalizeText(trimmed))

  const handleSelect = (ex) => {
    onChange(ex.id)
    setQuery(ex.name)
    setOpen(false)
  }

  const handleInputChange = (e) => {
    const v = e.target.value
    setQuery(v)
    setOpen(true)
    if (value) onChange('')
  }

  const handleCreateNew = async () => {
    if (!onCreateNew || !trimmed || creating) return
    setCreating(true)
    try {
      const created = await onCreateNew(trimmed)
      if (created) {
        onChange(created.id)
        setQuery(created.name)
        setOpen(false)
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="ex-autocomplete" ref={wrapRef}>
      <style jsx>{`
        .ex-autocomplete { position: relative; }
        .ex-ac-input { width: 100%; box-sizing: border-box; min-height: 32px; padding: 0 8px; border: 1px solid rgba(255,255,255,.08); border-radius: 7px; color: white; background: rgba(255,255,255,.035); font: inherit; font-size: 11px; outline: none; }
        .ex-ac-input:focus { border-color: rgba(249,115,22,.65); box-shadow: 0 0 0 3px rgba(249,115,22,.09); }
        .ex-ac-list { position: absolute; z-index: 30; top: calc(100% + 4px); left: 0; right: 0; max-height: 230px; overflow-y: auto; border: 1px solid rgba(255,255,255,.12); border-radius: 10px; background: #181818; box-shadow: 0 14px 34px rgba(0,0,0,.45); }
        .ex-ac-item { padding: 9px 12px; font-size: 12px; color: rgba(255,255,255,.82); cursor: pointer; }
        .ex-ac-item:hover { background: rgba(249,115,22,.16); color: white; }
        .ex-ac-empty { padding: 10px 12px; font-size: 11px; color: rgba(255,255,255,.4); }
        .ex-ac-create { color: #FDBA74; font-weight: 700; border-top: 1px solid rgba(255,255,255,.08); }
        .ex-ac-create:hover { background: rgba(249,115,22,.2); color: #FDBA74; }
      `}</style>
      <input
        className="ex-ac-input"
        type="text"
        value={query}
        placeholder={placeholder || 'Rechercher ou taper un nouveau nom…'}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div className="ex-ac-list">
          {filtered.map(ex => (
            <div key={ex.id} className="ex-ac-item" onMouseDown={() => handleSelect(ex)}>
              {ex.name}
            </div>
          ))}
          {trimmed && !exactMatch && onCreateNew && (
            <div className="ex-ac-item ex-ac-create" onMouseDown={handleCreateNew}>
              {creating ? 'Création…' : `＋ Créer « ${trimmed} »`}
            </div>
          )}
          {filtered.length === 0 && !trimmed && (
            <div className="ex-ac-empty">Aucun exercice trouvé</div>
          )}
        </div>
      )}
    </div>
  )
}
