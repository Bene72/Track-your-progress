'use client'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

const NAV = [
  { href: '/dashboard', label: 'Aujourd\'hui', icon: HomeIcon },
  { href: '/dashboard/wod', label: 'WOD', icon: BoardIcon },
  { href: '/dashboard/calendar', label: 'Calendrier', icon: CalendarIcon },
  { href: '/dashboard/pr', label: 'Mes PR', icon: TrophyIcon },
  { href: '/dashboard/box', label: 'Ma box', icon: UsersIcon },
]

function HomeIcon({ active }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.3 : 1.8}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
}
function BoardIcon({ active }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.3 : 1.8}><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="17" y2="13"/><line x1="7" y1="17" x2="13" y2="17"/></svg>
}
function CalendarIcon({ active }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.3 : 1.8}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function TrophyIcon({ active }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.3 : 1.8}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 9c0 3.31 2.69 6 6 6s6-2.69 6-6"/><path d="M9 22h6"/><path d="M12 15v7"/><path d="M6 2H2l4 7"/><path d="M18 2h4l-4 7"/></svg>
}
function UsersIcon({ active }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.3 : 1.8}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}

export default function DashboardLayout({ children }) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  return (
    <div className="shell">
      <nav className="topnav">
        <Link href="/dashboard" className="logo">BOX<span>LOG</span></Link>
        <button className="btn btnGhost btnSm" onClick={handleLogout} aria-label="Se déconnecter">Déconnexion</button>
      </nav>

      <main className="main">{children}</main>

      <nav className="mobileNav" aria-label="Navigation">
        {NAV.map(n => {
          const active = n.href === '/dashboard' ? pathname === n.href : pathname.startsWith(n.href)
          const Icon = n.icon
          return (
            <Link key={n.href} href={n.href} className={`mobileNavItem ${active ? 'mobileNavActive' : ''}`}>
              <Icon active={active} />
              <span>{n.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
