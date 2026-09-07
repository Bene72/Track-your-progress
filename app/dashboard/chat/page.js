'use client'
import { useEffect } from 'react'
import { useCurrentUser } from '../../../lib/hooks/useCurrentUser'
import { useBox } from '../../../lib/hooks/useBox'
import { useChatUnread } from '../../../lib/hooks/useChatUnread'
import BoxChat from '../../../components/BoxChat'

export default function ChatPage() {
  const { userId } = useCurrentUser({ redirectIfNull: true })
  const box = useBox()
  const { markRead } = useChatUnread(userId, box.activeBoxId)

  // Ouvrir la page vaut lecture : on remet le compteur à zéro pour cet
  // utilisateur (cf. badge sur l'onglet Chat dans la nav).
  useEffect(() => {
    if (userId && box.activeBoxId) markRead()
  }, [userId, box.activeBoxId, markRead])

  if (box.loading) return <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>

  return (
    <div className="stack">
      <div className="row">
        <h1 className="h1">Chat — {box.activeBoxName}</h1>
      </div>
      <BoxChat boxId={box.activeBoxId} userId={userId} channel="general" height={560} title="# general" />
    </div>
  )
}
