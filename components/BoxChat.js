'use client'
import { useState, useRef, useEffect } from 'react'
import { useBoxChat } from '../lib/hooks/useBoxChat'

function initials(name) {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
}

function formatTime(iso) {
  const d = new Date(iso)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// Chat autonome, réutilisable : chat général de box (page dédiée) OU fil de
// discussion attaché à un WOD / une séance perso (wodId / sessionId).
export default function BoxChat({ boxId, userId, channel = 'general', wodId = null, sessionId = null, programBlockId = null, title = 'Chat', height = 480 }) {
  const { messages, profiles, loading, sending, error, sendMessage, deleteMessage } =
    useBoxChat({ boxId, channel, wodId, sessionId, programBlockId, userId })
  const [draft, setDraft] = useState('')
  const listRef = useRef(null)

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages.length])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!draft.trim()) return
    const toSend = draft
    setDraft('')
    try {
      await sendMessage(toSend)
    } catch {
      setDraft(toSend) // on remet le brouillon si l'envoi échoue
    }
  }

  return (
    <div className="boxchat">
      <style jsx>{`
        .boxchat { display: flex; flex-direction: column; border: 1px solid rgba(255,255,255,.09); border-radius: 18px; background: rgba(255,255,255,.03); overflow: hidden; }
        .boxchat-head { padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,.08); font-weight: 800; font-size: 13px; letter-spacing: .02em; }
        .boxchat-list { flex: 1; overflow-y: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
        .msg { display: flex; gap: 8px; align-items: flex-start; }
        .msg.mine { flex-direction: row-reverse; }
        .avatar { flex: 0 0 30px; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 800; background: rgba(249,115,22,.18); color: #FDBA74; }
        .bubble { max-width: 78%; padding: 8px 11px; border-radius: 14px; background: rgba(255,255,255,.06); font-size: 13px; line-height: 1.45; word-break: break-word; position: relative; }
        .msg.mine .bubble { background: linear-gradient(135deg, rgba(249,115,22,.32), rgba(194,65,12,.28)); }
        .msg-meta { display: flex; gap: 6px; align-items: baseline; margin-bottom: 2px; }
        .msg-name { font-size: 11px; font-weight: 800; color: rgba(255,255,255,.7); }
        .msg-time { font-size: 10px; color: rgba(255,255,255,.4); }
        .msg-del { border: 0; background: transparent; color: rgba(255,255,255,.35); font-size: 10px; cursor: pointer; margin-left: 6px; }
        .msg-del:hover { color: #ff8d8d; }
        .msg.optimistic .bubble { opacity: .6; }
        .boxchat-empty { flex: 1; display: grid; place-items: center; color: rgba(255,255,255,.4); font-size: 13px; padding: 20px; text-align: center; }
        .boxchat-form { display: flex; gap: 8px; padding: 10px; border-top: 1px solid rgba(255,255,255,.08); }
        .boxchat-input { flex: 1; min-height: 40px; padding: 0 12px; border: 1px solid rgba(255,255,255,.1); border-radius: 12px; color: white; background: rgba(255,255,255,.04); font: inherit; font-size: 13px; outline: none; }
        .boxchat-input:focus { border-color: rgba(249,115,22,.6); }
        .boxchat-send { flex: 0 0 auto; min-height: 40px; padding: 0 16px; border: 0; border-radius: 12px; color: white; background: linear-gradient(135deg, #F97316, #C2410C); font: inherit; font-size: 13px; font-weight: 800; cursor: pointer; }
        .boxchat-send:disabled { opacity: .5; cursor: default; }
        .boxchat-error { padding: 8px 14px; color: #ff9d9d; font-size: 12px; }
      `}</style>

      <div className="boxchat-head">{title}</div>

      <div className="boxchat-list" ref={listRef} style={{ maxHeight: height }}>
        {loading && <div className="boxchat-empty">Chargement du chat…</div>}
        {!loading && messages.length === 0 && (
          <div className="boxchat-empty">Aucun message pour l&apos;instant. Lance la conversation 👋</div>
        )}
        {messages.map(m => {
          const mine = m.user_id === userId
          const name = mine ? 'Toi' : (profiles[m.user_id]?.full_name || 'Membre')
          return (
            <div key={m.id} className={`msg ${mine ? 'mine' : ''} ${m._optimistic ? 'optimistic' : ''}`}>
              <div className="avatar">{initials(name === 'Toi' ? (profiles[userId]?.full_name || 'Moi') : name)}</div>
              <div className="bubble">
                <div className="msg-meta">
                  <span className="msg-name">{name}</span>
                  <span className="msg-time">{formatTime(m.created_at)}</span>
                  {mine && !m._optimistic && (
                    <button className="msg-del" onClick={() => deleteMessage(m.id)} aria-label="Supprimer">✕</button>
                  )}
                </div>
                {m.content}
              </div>
            </div>
          )
        })}
      </div>

      {error && <div className="boxchat-error">{error}</div>}

      <form className="boxchat-form" onSubmit={handleSubmit}>
        <input
          className="boxchat-input"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Écrire un message…"
          maxLength={2000}
        />
        <button className="boxchat-send" type="submit" disabled={sending || !draft.trim()}>Envoyer</button>
      </form>
    </div>
  )
}
