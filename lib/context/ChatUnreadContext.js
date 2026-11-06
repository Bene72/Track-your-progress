'use client'
import { createContext, useContext } from 'react'

// Le compteur de messages non lus est calculé UNE SEULE FOIS, dans
// DashboardShell (app/dashboard/layout.js), puis partagé via ce contexte.
// Appeler useChatUnread ailleurs ouvrirait un 2e abonnement Realtime sur le
// même channel et ferait planter l'appli ("cannot add `postgres_changes`
// callbacks ... after `subscribe()`").
const ChatUnreadContext = createContext({ unreadCount: 0, markRead: () => {} })

export const ChatUnreadProvider = ChatUnreadContext.Provider

export function useChatUnreadContext() {
  return useContext(ChatUnreadContext)
}
