'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Ticket, LogOut, LayoutDashboard, ShieldCheck, User } from 'lucide-react'
import { cn } from '@/lib/utils'

type NavUser = { name: string; role: string; phone: string } | null

const NAV_LINKS = [
  { href: '/',       label: 'Home'    },
  { href: '/events', label: 'Events'  },
  { href: '/merch',  label: 'Merch'   },
  { href: '/gallery',label: 'Gallery' },
  { href: '/about',  label: 'About'   },
]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<NavUser>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => { if (d.success) setUser(d.data) })
      .catch(() => {})
  }, [pathname])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    router.push('/')
    router.refresh()
  }

  return (
    <nav className={cn(
      'fixed top-0 left-0 right-0 z-50 transition-all duration-300 h-16',
      scrolled
        ? 'bg-[#0a0a0a]/95 backdrop-blur-md border-b border-[#2a2a2a]'
        : 'bg-transparent'
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center shrink-0">
          <img
            src="https://nxt-stop.lon1.cdn.digitaloceanspaces.com/nxt-stop%20logo%20png.png"
            alt="NXT STOP"
            className="h-8 w-auto object-contain invert"
          />
        </Link>

        {/* Desktop centre links */}
        <div className="hidden md:flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
          {NAV_LINKS.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'text-sm font-medium transition-colors',
                pathname === l.href ? 'text-purple-400' : 'text-gray-400 hover:text-white'
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Desktop right actions */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              {user.role === 'admin' && (
                <Link
                  href="/admin"
                  className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-purple-400 transition-colors"
                >
                  <ShieldCheck size={15} />
                  Admin
                </Link>
              )}
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <LayoutDashboard size={15} />
                Dashboard
              </Link>
              <Link
                href="/dashboard/tickets"
                className="flex items-center gap-1.5 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-gray-300 hover:border-purple-500/50 transition-all"
              >
                <Ticket size={13} />
                My Tickets
              </Link>
              <button
                onClick={logout}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-400 transition-colors"
              >
                <LogOut size={13} />
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
                Sign In
              </Link>
              <Link
                href="/register"
                className="text-sm bg-purple-600 hover:bg-purple-500 text-white rounded-lg px-4 py-2 font-medium transition-all"
              >
                Get Tickets
              </Link>
            </>
          )}
        </div>

        {/* Mobile right */}
        <div className="flex md:hidden items-center gap-2">
          {user ? (
            <>
              {user.role === 'admin' && (
                <Link
                  href="/admin"
                  className="w-9 h-9 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400"
                  aria-label="Admin"
                >
                  <ShieldCheck size={17} />
                </Link>
              )}
              <Link
                href="/dashboard"
                className="w-9 h-9 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400"
                aria-label="Dashboard"
              >
                <User size={17} />
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm font-medium text-purple-400 border border-purple-500/30 rounded-lg px-3 py-1.5"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
