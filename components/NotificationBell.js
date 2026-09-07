'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from '../lib/hooks/useCurrentUser'
import { useNotifications } from '../lib/hooks/useNotifications'

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'à l\'instant'
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  return `il y a ${days} j`
}

export default function NotificationBell() {
  const { userId } = useCurrentUser()
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(userId)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const router = useRouter()

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  if (!userId) return null

  const handleClick = (n) => {
    setOpen(false)
    if (!n.read) markAsRead(n.id)
    if (n.link) router.push(n.link)
  }

  return (
    <div className="nbell" ref={ref}>
      <style jsx>{`
        .nbell { position: relative; }
        .nbell-trigger { position: relative; width: 36px; height: 36px; display: grid; place-items: center; border: 1px solid rgba(255,255,255,.1); border-radius: 10px; color: rgba(255,255,255,.7); background: rgba(255,255,255,.03); cursor: pointer; }
        .nbell-trigger:hover { color: white; border-color: rgba(249,115,22,.4); }
        .nbell-dot { position: absolute; top: -3px; right: -3px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 999px; background: #F97316; color: white; font-size: 9px; font-weight: 800; display: grid; place-items: center; }
        .nbell-panel { position: absolute; top: 44px; right: 0; z-index: 50; width: 300px; max-height: 380px; overflow-y: auto; border: 1px solid rgba(255,255,255,.12); border-radius: 14px; background: #17140F; box-shadow: 0 16px 40px rgba(0,0,0,.5); }
        .nbell-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,.08); }
        .nbell-title { font-size: 12.5px; font-weight: 800; }
        .nbell-mark-all { border: 0; background: transparent; color: #FDBA74; font: inherit; font-size: 11px; font-weight: 700; cursor: pointer; }
        .nbell-item { display: block; width: 100%; padding: 10px 12px; border: 0; border-bottom: 1px solid rgba(255,255,255,.05); background: transparent; text-align: left; cursor: pointer; }
        .nbell-item:hover { background: rgba(249,115,22,.08); }
        .nbell-item.unread { background: rgba(249,115,22,.05); }
        .nbell-item-title { font-size: 12px; font-weight: 750; color: white; margin-bottom: 2px; }
        .nbell-item-body { font-size: 11px; color: rgba(255,255,255,.55); margin-bottom: 3px; }
        .nbell-item-time { font-size: 10px; color: rgba(255,255,255,.35); }
        .nbell-empty { padding: 24px 12px; text-align: center; color: rgba(255,255,255,.4); font-size: 12px; }
      `}</style>

      <button type="button" className="nbell-trigger" onClick={() => setOpen(o => !o)} aria-label="Notifications">
        🔔
        {unreadCount > 0 && <span className="nbell-dot">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="nbell-panel">
          <div className="nbell-head">
            <span className="nbell-title">Notifications</span>
            {unreadCount > 0 && <button type="button" className="nbell-mark-all" onClick={markAllAsRead}>Tout marquer comme lu</button>}
          </div>
          {notifications.length === 0 ? (
            <div className="nbell-empty">Rien pour l&apos;instant.</div>
          ) : (
            notifications.map(n => (
              <button key={n.id} type="button" className={`nbell-item ${!n.read ? 'unread' : ''}`} onClick={() => handleClick(n)}>
                <div className="nbell-item-title">{n.title}</div>
                {n.body && <div className="nbell-item-body">{n.body}</div>}
                <div className="nbell-item-time">{timeAgo(n.created_at)}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
