'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  CalendarDays,
  Ticket,
  User,
  ShieldCheck,
  ShoppingBag,
  Images,
  Clapperboard,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

type TabDef = { href: string; icon: typeof Home; label: string; exact: boolean }

const MAIN_TABS: TabDef[] = [
  { href: '/', icon: Home, label: 'Home', exact: true },
  { href: '/events', icon: CalendarDays, label: 'Events', exact: false },
  { href: '/merch', icon: ShoppingBag, label: 'Merch', exact: false },
  { href: '/gallery', icon: Images, label: 'Gallery', exact: false },
  { href: '/videos', icon: Clapperboard, label: 'Videos', exact: false },
  { href: '/dashboard/tickets', icon: Ticket, label: 'Tickets', exact: false },
  { href: '/dashboard', icon: User, label: 'Profile', exact: true },
]

const ADMIN_TAB: TabDef = { href: '/admin', icon: ShieldCheck, label: 'Admin', exact: false }

// Don't show bottom nav on admin, gate, or auth pages
const HIDDEN_PREFIXES = ['/admin', '/gate', '/login', '/register']

function tabIsActive(pathname: string, tab: TabDef): boolean {
  if (tab.exact) return pathname === tab.href
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`)
}

export default function BottomNav() {
  const pathname = usePathname()
  const [loggedIn, setLoggedIn] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        setLoggedIn(d.success)
        setIsAdmin(d.success && d.data?.role === 'admin')
      })
      .catch(() => {})
  }, [pathname])

  if (HIDDEN_PREFIXES.some(p => pathname.startsWith(p))) return null

  const profileHref = loggedIn ? '/dashboard' : '/login'
  const tabs = isAdmin
    ? [
        MAIN_TABS[0],
        MAIN_TABS[1],
        MAIN_TABS[2],
        MAIN_TABS[3],
        MAIN_TABS[4],
        ADMIN_TAB,
        MAIN_TABS[5],
        MAIN_TABS[6],
      ]
    : MAIN_TABS

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#0f0f0f]/95 backdrop-blur-md border-t border-[#2a2a2a] bottom-nav-safe">
      <div className="bottom-nav-scroll flex items-stretch">
        {tabs.map(tab => {
          const href = tab.href === '/dashboard' ? profileHref : tab.href
          const active = tabIsActive(pathname, tab)

          return (
            <Link
              key={`${tab.href}-${tab.label}`}
              href={href}
              className={cn('bottom-nav-tab bottom-nav-tab--scroll', active && 'active')}
            >
              <tab.icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[9px] font-medium tracking-wide text-center leading-tight px-0.5">
                {tab.label === 'Profile' && !loggedIn ? 'Sign In' : tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
