'use client'
import { useEffect, useState } from 'react'
import { useCurrentUser } from '../../../lib/hooks/useCurrentUser'
import { useBox } from '../../../lib/hooks/useBox'
import { useChatUnread } from '../../../lib/hooks/useChatUnread'
import BoxChat from '../../../components/BoxChat'

// Salons façon Discord, rangés par catégories. L'id est la valeur passée à
// BoxChat (colonne "channel" des messages) : "general" reste le premier salon
// pour que les anciens messages restent visibles. Pour ajouter un salon, il
// suffit d'ajouter une ligne ici.
const CHANNEL_GROUPS = [
  { label: 'Général', channels: [
    { id: 'general', icon: '💬', name: 'général', desc: 'Discussion libre entre tous les membres de la box' },
    { id: 'annonces', icon: '📣', name: 'annonces', desc: 'Infos importantes : horaires, événements, nouveautés' },
  ] },
  { label: 'Entraînement', channels: [
    { id: 'programme', icon: '🏋️', name: 'programme', desc: 'Questions et retours sur les séances de la semaine' },
    { id: 'resultats', icon: '🏆', name: 'résultats-pr', desc: 'Partage tes records et tes scores' },
  ] },
  { label: 'Vie de la box', channels: [
    { id: 'nutrition', icon: '🥗', name: 'nutrition', desc: 'Recettes, conseils, questions d\'alimentation' },
    { id: 'questions', icon: '❓', name: 'questions-coach', desc: 'Pose tes questions au coach' },
    { id: 'off-topic', icon: '☕', name: 'off-topic', desc: 'Tout le reste' },
  ] },
]

const ALL_CHANNELS = CHANNEL_GROUPS.flatMap(g => g.channels)
const STORAGE_KEY = 'chat:lastChannel'

export default function ChatPage() {
  const { userId } = useCurrentUser({ redirectIfNull: true })
  const box = useBox()
  const { markRead } = useChatUnread(userId, box.activeBoxId)
  const [channelId, setChannelId] = useState('general')

  // Retrouve le dernier salon ouvert (par navigateur).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved && ALL_CHANNELS.some(c => c.id === saved)) setChannelId(saved)
    } catch {}
  }, [])

  function selectChannel(id) {
    setChannelId(id)
    try { localStorage.setItem(STORAGE_KEY, id) } catch {}
  }

  // Ouvrir la page vaut lecture : on remet le compteur à zéro pour cet
  // utilisateur (cf. badge sur l'onglet Chat dans la nav).
  useEffect(() => {
    if (userId && box.activeBoxId) markRead()
  }, [userId, box.activeBoxId, markRead])

  if (box.loading) return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>

  const current = ALL_CHANNELS.find(c => c.id === channelId) || ALL_CHANNELS[0]

  return (
    <div className="stack">
      <div className="row">
        <h1 className="h1">Chat — {box.activeBoxName}</h1>
      </div>

      <div className="chatLayout">
        <nav className="chatChannels" aria-label="Salons">
          {CHANNEL_GROUPS.map(group => (
            <div key={group.label} className="chatGroup">
              <div className="chatGroupLabel">{group.label}</div>
              <div className="chatGroupItems">
                {group.channels.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    className={`chatChannel ${c.id === current.id ? 'chatChannelActive' : ''}`}
                    aria-current={c.id === current.id ? 'true' : undefined}
                    onClick={() => selectChannel(c.id)}
                  >
                    <span className="chatChannelIcon">{c.icon}</span>
                    <span># {c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <section className="chatMain">
          <header className="chatHeader">
            <div className="chatHeaderTitle"># {current.name}</div>
            <div className="chatHeaderDesc">{current.desc}</div>
          </header>
          {/* key = remonte BoxChat à chaque changement de salon (nouvel abonnement Realtime propre) */}
          <BoxChat
            key={current.id}
            boxId={box.activeBoxId}
            userId={userId}
            channel={current.id}
            height={560}
            title={`# ${current.name}`}
          />
        </section>
      </div>

      <style jsx global>{`
        .chatLayout { display: flex; flex-direction: column; gap: 12px; }
        .chatChannels { display: flex; gap: 14px; overflow-x: auto; padding-bottom: 4px; }
        .chatGroup { display: flex; flex-direction: column; gap: 4px; flex-shrink: 0; }
        .chatGroupLabel { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--chalk-muted); padding: 0 4px; }
        .chatGroupItems { display: flex; gap: 6px; }
        .chatChannel {
          display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 10px; white-space: nowrap;
          border: 1px solid var(--border); background: var(--bg-card); color: var(--chalk); font-size: 14px; cursor: pointer;
        }
        .chatChannel:hover { background: var(--bg-card-2); }
        .chatChannelActive { background: var(--accent-dim); color: var(--accent); border-color: var(--accent); font-weight: 600; }
        .chatMain { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 8px; }
        .chatHeader { padding: 0 2px; }
        .chatHeaderTitle { font-size: 16px; font-weight: 700; }
        .chatHeaderDesc { font-size: 13px; color: var(--chalk-muted); }

        @media (min-width: 768px) {
          .chatLayout { flex-direction: row; align-items: flex-start; gap: 16px; }
          .chatChannels {
            flex-direction: column; overflow: visible; width: 220px; flex-shrink: 0; gap: 16px;
            padding: 12px; border: 1px solid var(--border); border-radius: 14px; background: var(--bg-card);
          }
          .chatGroupItems { flex-direction: column; gap: 2px; }
          .chatChannel { border: none; background: transparent; width: 100%; padding: 8px 10px; }
          .chatChannelActive { border: none; }
        }
      `}</style>
    </div>
  )
}
