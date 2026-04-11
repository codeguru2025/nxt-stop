'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CalendarDays, Ticket, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

const TABS = [
  { href: '/',                  icon: Home,         label: 'Home',    exact: true  },
  { href: '/events',            icon: CalendarDays, label: 'Events',  exact: false },
  { href: '/dashboard/tickets', icon: Ticket,       label: 'Tickets', exact: false },
  { href: '/dashboard',         icon: User,         label: 'Profile', exact: true  },
]

// Don't show bottom nav on admin, gate, or auth pages
const HIDDEN_PREFIXES = ['/admin', '/gate', '/login', '/register']

export default function BottomNav() {
  const pathname = usePathname()
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => setLoggedIn(d.success))
      .catch(() => {})
  }, [pathname])

  if (HIDDEN_PREFIXES.some(p => pathname.startsWith(p))) return null

  const profileHref = loggedIn ? '/dashboard' : '/login'

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#0f0f0f]/95 backdrop-blur-md border-t border-[#2a2a2a] bottom-nav-safe">
      <div className="flex items-stretch">
        {TABS.map(tab => {
          const href = tab.href === '/dashboard' ? profileHref : tab.href
          const active = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href)

          return (
            <Link
              key={tab.href}
              href={href}
              className={cn('bottom-nav-tab', active && 'active')}
            >
              <tab.icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[10px] font-medium tracking-wide">
                {tab.label === 'Profile' && !loggedIn ? 'Sign In' : tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
