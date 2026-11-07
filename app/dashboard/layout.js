'use client'
import { useState, useRef, useEffect, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { BoxProvider, useBoxContext } from '../../lib/context/BoxContext'
import { useChatUnread } from '../../lib/hooks/useChatUnread'
import { ChatUnreadProvider } from '../../lib/context/ChatUnreadContext'
import NotificationBell from '../../components/NotificationBell'

// Navigation en familles (inspirée des apps de coaching type FORGED) :
//  - grand écran (≥ 1024 px) : barre latérale à gauche, toutes les familles ;
//  - mobile : barre du bas = les 3 piliers d'entraînement (PRIMARY_HREFS) +
//    "Plus", qui ouvre les AUTRES entrées rangées par famille.
// Une seule source de vérité : ajouter une page ici la fait apparaître aux deux
// endroits. coachOnly = visible pour les coachs de la box uniquement.
const NAV_GROUPS = [
  { label: null, items: [
    { href: '/dashboard', label: 'Aujourd\'hui', icon: HomeIcon, exact: true },
  ] },
  { label: 'Entraînement', items: [
    { href: '/dashboard/programme', label: 'Programme', icon: ProgramIcon },
    { href: '/dashboard/perso', label: 'Perso', icon: DumbbellIcon },
    { href: '/dashboard/calendar', label: 'Calendrier', icon: CalendarIcon },
    { href: '/dashboard/pr', label: 'Mes PR', icon: TrophyIcon },
  ] },
  { label: 'Ma box', items: [
    { href: '/dashboard/wod', label: 'Le tableau', icon: BoardIcon },
    { href: '/dashboard/chat', label: 'Chat', icon: ChatIcon, chat: true },
    { href: '/dashboard/box', label: 'Ma box', icon: UsersIcon },
    { href: '/dashboard/coach', label: 'Dashboard coach', short: 'Coach', icon: ChartIcon, coachOnly: true },
  ] },
]

const PRIMARY_HREFS = ['/dashboard', '/dashboard/perso', '/dashboard/programme']
const PRIMARY_NAV = PRIMARY_HREFS.map(href => NAV_GROUPS.flatMap(g => g.items).find(i => i.href === href))

// Barre du bas version COACH (mobile) : le Chat (avec son badge de non-lus) et
// le Dashboard coach sortent de "Plus". Les adhérents gardent PRIMARY_HREFS /
// PRIMARY_NAV ci-dessus, strictement inchangés.
const COACH_PRIMARY_HREFS = ['/dashboard', '/dashboard/programme', '/dashboard/chat', '/dashboard/coach']
const COACH_PRIMARY_NAV = COACH_PRIMARY_HREFS.map(href => NAV_GROUPS.flatMap(g => g.items).find(i => i.href === href))

// Page courante : correspondance exacte ou sous-page ("/dashboard/programme/12").
// Un simple startsWith serait faux : "/dashboard/programme" commence par
// "/dashboard/pr" et allumerait aussi "Mes PR".
function isItemActive(item, pathname) {
  return pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`))
}

function visibleGroups(groups, isCoach) {
  return groups
    .map(g => ({ ...g, items: g.items.filter(i => !i.coachOnly || isCoach) }))
    .filter(g => g.items.length > 0)
}

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

function BoardIcon({ active }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.3 : 1.8}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>
}
function ChartIcon({ active }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.3 : 1.8}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>
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
// à useChatUnread dans DashboardShell ci-dessous, jamais d'un hook par instance —
// sinon 2 composants qui s'abonnent au même channel Realtime
// (`chat-unread:{boxId}:{channel}`) font planter l'appli avec "cannot add
// postgres_changes callbacks ... after subscribe()" dès que le 2e .on() est
// posé sur un channel déjà souscrit par le 1er.
function ChatUnreadDot({ count }) {
  if (!count) return null
  return <span className="navUnreadDot">{count > 9 ? '9+' : count}</span>
}

// Popover "Plus" : les entrées qui ne sont pas dans la barre mobile (3 piliers
// d'entraînement + Plus), rangées par famille comme dans la barre latérale.
// Le compteur de non-lus arrive en prop : UN SEUL useChatUnread dans toute
// l'appli (cf. commentaire plus haut).
function MoreMenu({ pathname, isCoach, unreadCount, primaryHrefs = PRIMARY_HREFS }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const groups = visibleGroups(
    NAV_GROUPS.map(g => ({ ...g, items: g.items.filter(i => !primaryHrefs.includes(i.href)) })),
    isCoach
  )
  const isActive = groups.some(g => g.items.some(n => isItemActive(n, pathname)))

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
        <div className="moreMenuPanel" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {groups.map(group => (
            <div key={group.label}>
              <div className="eyebrow" style={{ padding: '8px 12px 2px', fontSize: 10, color: 'var(--chalk-muted)' }}>{group.label}</div>
              {group.items.map(n => {
                const active = isItemActive(n, pathname)
                const Icon = n.icon
                return (
                  <Link key={n.href} href={n.href} className={`moreMenuItem ${active ? 'moreMenuItemActive' : ''}`} onClick={() => setOpen(false)}>
                    <span style={{ position: 'relative' }}>
                      <Icon active={active} />
                      {n.chat && <ChatUnreadDot count={unreadCount} />}
                    </span>
                    {n.label}
                  </Link>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Barre latérale (grand écran uniquement) : toutes les familles, la page
// courante en évidence, la box et le rôle en bas.
function SideNav({ pathname, isCoach, unreadCount, boxName }) {
  const groups = visibleGroups(NAV_GROUPS, isCoach)
  return (
    <aside className="sideNav" aria-label="Menu principal">
      <Link href="/dashboard" className="logo sideLogo">BOX<span>LOG</span></Link>
      <div className="sideScroll">
        {groups.map((group, gi) => (
          <div key={group.label || gi}>
            {group.label && <div className="sideGroup">{group.label}</div>}
            {group.items.map(item => {
              const active = isItemActive(item, pathname)
              const Icon = item.icon
              return (
                <Link key={item.href} href={item.href} className={`sideItem ${active ? 'sideItemActive' : ''}`} aria-current={active ? 'page' : undefined}>
                  <Icon active={active} />
                  <span>{item.label}</span>
                  {item.chat && unreadCount > 0 && <span className="sideBadge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                </Link>
              )
            })}
          </div>
        ))}
      </div>
      <div className="sideFoot">
        <div className="sideFootName">{boxName || 'Ma box'}</div>
        <div className="sideFootRole">{isCoach ? 'Coach' : 'Membre'}</div>
      </div>
      {/* Styles à portée globale : le CSS scopé de styled-jsx ne s'applique pas aux <Link> de Next */}
      <style jsx global>{`
        .sideNav { display: none; }
        @media (min-width: 1024px) {
          .sideNav {
            display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; width: 248px; z-index: 15;
            background: var(--bg-card); border-right: 1px solid var(--border); padding: 16px 12px;
          }
        }
        .sideLogo { padding: 0 10px 14px; font-size: 26px; }
        .sideScroll { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
        .sideGroup { margin: 16px 10px 4px; font-size: 12px; font-weight: 600; color: var(--chalk-muted); }
        .sideItem {
          display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 10px;
          color: var(--chalk); font-size: 14px;
        }
        .sideItem:hover { background: var(--bg-card-2); }
        .sideItemActive { background: var(--accent-dim); color: var(--accent); font-weight: 600; }
        .sideBadge { margin-left: auto; padding: 1px 7px; border-radius: 9px; background: var(--accent); color: #16110D; font-size: 11px; font-weight: 700; }
        .sideFoot { padding: 12px 10px 0; border-top: 1px solid var(--border); }
        .sideFootName { font-size: 14px; font-weight: 600; }
        .sideFootRole { font-size: 12px; color: var(--chalk-muted); }
      `}</style>
    </aside>
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

// Réglages de mise en page grand écran, RÉSERVÉS AUX COACHS : tout est accroché
// à .shellCoach, classe posée sur .shell uniquement si l'utilisateur est coach
// de la box active. Un adhérent garde l'affichage d'origine (barre du haut +
// navigation du bas). Les classes .main / .topnav / .mobileNav vivent dans
// globals.css : on les ajuste ici, uniquement au-delà de 1024 px.
//   - .main:has(.wideBoard) : la vue semaine en 7 colonnes a besoin de largeur.
function DesktopLayoutStyles() {
  return (
    <style jsx global>{`
      @media (min-width: 1024px) {
        .shellCoach { padding-left: 248px; }
        .shellCoach .mobileNav { display: none; }
        .shellCoach .topnav .logo { display: none; }
        .shellCoach .topnav { justify-content: flex-end; }
        .shellCoach .main { padding-bottom: 48px; }
        .shellCoach .main:has(.wideBoard) { max-width: 1240px; }
      }
      /* Mobile coach : 5 entrées (4 + Plus) réparties à parts égales */
      @media (max-width: 1023px) {
        .shellCoach .mobileNav { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); }
      }
    `}</style>
  )
}

function DashboardShell({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const { userId, activeBoxId, activeBoxName, isCoach, loading } = useBoxContext()
  // Barre latérale et mise en page grand écran : coach uniquement, une fois le rôle connu.
  const showSide = !loading && !!isCoach
  // Barre du bas : version coach (Chat + Coach en direct) ou version d'origine pour les adhérents.
  const primaryNav = showSide ? COACH_PRIMARY_NAV : PRIMARY_NAV
  const primaryHrefs = showSide ? COACH_PRIMARY_HREFS : PRIMARY_HREFS
  // UN SEUL abonnement Realtime pour le chat (cf. ChatUnreadDot) : le compteur
  // est transmis à la barre latérale ET au menu "Plus".
  const { unreadCount, markRead } = useChatUnread(userId, activeBoxId)
  // Partagé avec la page Chat (qui ne doit PAS rappeler useChatUnread).
  const chatUnread = useMemo(() => ({ unreadCount, markRead }), [unreadCount, markRead])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  return (
    <ChatUnreadProvider value={chatUnread}>
    <div className={`shell ${showSide ? 'shellCoach' : ''}`}>
      {showSide && <DesktopLayoutStyles />}
      {showSide && <SideNav pathname={pathname} isCoach={isCoach} unreadCount={unreadCount} boxName={activeBoxName} />}

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
        {primaryNav.map(n => {
          const active = isItemActive(n, pathname)
          const Icon = n.icon
          return (
            <Link key={n.href} href={n.href} className={`mobileNavItem ${active ? 'mobileNavActive' : ''}`}>
              {n.chat ? (
                <span style={{ position: 'relative' }}>
                  <Icon active={active} />
                  <ChatUnreadDot count={unreadCount} />
                </span>
              ) : (
                <Icon active={active} />
              )}
              <span>{n.short || n.label}</span>
            </Link>
          )
        })}
        <MoreMenu pathname={pathname} isCoach={isCoach} primaryHrefs={primaryHrefs} unreadCount={primaryHrefs.includes('/dashboard/chat') ? 0 : unreadCount} />
      </nav>
    </div>
    </ChatUnreadProvider>
  )
}

export default function DashboardLayout({ children }) {
  return (
    <BoxProvider>
      <DashboardShell>{children}</DashboardShell>
    </BoxProvider>
  )
}
