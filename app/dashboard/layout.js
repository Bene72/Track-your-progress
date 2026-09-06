'use client'
import { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { BoxProvider, useBoxContext } from '../../lib/context/BoxContext'
import { useChatUnread } from '../../lib/hooks/useChatUnread'
import NotificationBell from '../../components/NotificationBell'

// Nav principale : les 3 piliers d'entraînement (WOD de box, Perso,
// Programme coach→athlète). Calendrier est accessible depuis "Aujourd'hui"
// (bouton en haut de la page) + reste dans "Plus" pour ne pas ajouter de 5e
// item à la barre mobile.
const PRIMARY_NAV = [
  { href: '/dashboard', label: 'Aujourd\'hui', icon: HomeIcon },
  { href: '/dashboard/perso', label: 'Perso', icon: DumbbellIcon },
  { href: '/dashboard/programme', label: 'Programme', icon: ProgramIcon },
]

const MORE_NAV = [
  { href: '/dashboard/calendar', label: 'Calendrier', icon: CalendarIcon },
  { href: '/dashboard/pr', label: 'Mes PR', icon: TrophyIcon },
  { href: '/dashboard/chat', label: 'Chat', icon: ChatIcon },
  { href: '/dashboard/box', label: 'Ma box', icon: UsersIcon },
]

function HomeIcon({ active }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.3 : 1.8}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
}
function DumbbellIcon({ active }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.3 : 1.8}><path d="M6.5 6.5l11 11"/><path d="M21 21l-1.5-1.5"/><path d="M3 3l1.5 1.5"/><path d="M18 6l3 3-1.5 1.5-3-3z"/><path d="M6 18l-3-3 1.5-1.5 3 3z"/><path d="M9 6l1.5-1.5L14 8l-1.5 1.5z"/><path d="M8 14l1.5 1.5L6 19l-1.5-1.5z"/></svg>
}
function CalendarIcon({ active }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.3 : 1.8}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function TrophyIcon({ active }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.3 : 1.8}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 9c0 3.31 2.69 6 6 6s6-2.69 6-6"/><path d="M9 22h6"/><path d="M12 15v7"/><path d="M6 2H2l4 7"/><path d="M18 2h4l-4 7"/></svg>
}
function ChatIcon({ active }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.3 : 1.8}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
}
function ProgramIcon({ active }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.3 : 1.8}><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M8 13h3M8 17h6"/></svg>
}
function UsersIcon({ active }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.3 : 1.8}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}

function MoreIcon({ active }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.3 : 1.8}><circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none"/></svg>
}

function BoxErrorBanner() {
  const { error } = useBoxContext()
  if (!error) return null
  return (
    <div className="errorBox" style={{ margin: '12px 16px 0' }} role="alert">
      {error}
    </div>
  )
}

// Petit badge "non lu" affiché à 2 endroits (déclencheur "Plus" + item Chat
// du panneau). Composant purement visuel : le comptage vient d'un SEUL appel
// à useChatUnread dans MoreMenu ci-dessous, jamais d'un hook par instance —
// sinon 2 composants qui s'abonnent au même channel Realtime
// (`chat-unread:{boxId}:{channel}`) font planter l'appli avec "cannot add
// postgres_changes callbacks ... after subscribe()" dès que le 2e .on() est
// posé sur un channel déjà souscrit par le 1er.
function ChatUnreadDot({ count }) {
  if (!count) return null
  return <span className="navUnreadDot">{count > 9 ? '9+' : count}</span>
}

// Popover "Plus" : regroupe Calendrier / Mes PR / Chat / Ma box pour garder
// une barre de nav mobile à 4 items (les 3 piliers d'entraînement + Plus).
function MoreMenu({ pathname }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const isActive = MORE_NAV.some(n => pathname.startsWith(n.href))
  const { userId, activeBoxId } = useBoxContext()
  const { unreadCount } = useChatUnread(userId, activeBoxId)

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div className="moreMenu" ref={ref}>
      <button
        type="button"
        className={`mobileNavItem moreMenuTrigger ${isActive ? 'mobileNavActive' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ position: 'relative' }}>
          <MoreIcon active={isActive} />
          <ChatUnreadDot count={unreadCount} />
        </span>
        <span>Plus</span>
      </button>
      {open && (
        <div className="moreMenuPanel">
          {MORE_NAV.map(n => {
            const active = pathname.startsWith(n.href)
            const Icon = n.icon
            return (
              <Link key={n.href} href={n.href} className={`moreMenuItem ${active ? 'moreMenuItemActive' : ''}`} onClick={() => setOpen(false)}>
                <span style={{ position: 'relative' }}>
                  <Icon active={active} />
                  {n.href === '/dashboard/chat' && <ChatUnreadDot count={unreadCount} />}
                </span>
                {n.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Menu "•••" de la top bar — actions transverses qui n'ont pas leur place
// dans la nav principale (inspiré des apps concurrentes type FORGED).
function TopKebabMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div className="kebab" ref={ref}>
      <button type="button" className="kebabBtn" onClick={() => setOpen(v => !v)} aria-label="Plus d'options">⋯</button>
      {open && (
        <div className="kebabPanel">
          <Link href="/dashboard/pr" className="kebabItem" onClick={() => setOpen(false)}>🕓 Historique</Link>
          <Link href="/dashboard/box" className="kebabItem" onClick={() => setOpen(false)}>👥 Vue de groupe (box)</Link>
        </div>
      )}
    </div>
  )
}

export default function DashboardLayout({ children }) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  return (
    <BoxProvider>
      <div className="shell">
        <nav className="topnav">
          <Link href="/dashboard" className="logo">BOX<span>LOG</span></Link>
          <div className="topnavActions">
            <NotificationBell />
            <TopKebabMenu />
            <button className="btn btnGhost btnSm" onClick={handleLogout} aria-label="Se déconnecter">Déconnexion</button>
          </div>
        </nav>

        <BoxErrorBanner />

        <main className="main">{children}</main>

        <nav className="mobileNav" aria-label="Navigation">
          {PRIMARY_NAV.map(n => {
            const active = n.href === '/dashboard' ? pathname === n.href : pathname.startsWith(n.href)
            const Icon = n.icon
            return (
              <Link key={n.href} href={n.href} className={`mobileNavItem ${active ? 'mobileNavActive' : ''}`}>
                <Icon active={active} />
                <span>{n.label}</span>
              </Link>
            )
          })}
          <MoreMenu pathname={pathname} />
        </nav>
      </div>
    </BoxProvider>
  )
}
