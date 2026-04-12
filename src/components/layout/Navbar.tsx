'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import {
  Ticket,
  LogOut,
  LayoutDashboard,
  ShieldCheck,
  User,
  Menu,
  X,
  Home,
  CalendarDays,
  ShoppingBag,
  Images,
  Clapperboard,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type NavUser = { name: string; role: string; phone: string } | null

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/events', label: 'Events' },
  { href: '/merch', label: 'Merch' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/videos', label: 'Past Videos' },
  { href: '/dashboard/tickets', label: 'Tickets' },
  { href: '/about', label: 'About' },
]

const MOBILE_SHEET_LINKS: {
  href: string
  label: string
  icon: typeof Home
  exact?: boolean
}[] = [
  { href: '/', label: 'Home', icon: Home, exact: true },
  { href: '/events', label: 'Events', icon: CalendarDays },
  { href: '/merch', label: 'Merch', icon: ShoppingBag },
  { href: '/gallery', label: 'Gallery', icon: Images },
  { href: '/videos', label: 'Videos', icon: Clapperboard },
  { href: '/dashboard/tickets', label: 'Tickets', icon: Ticket },
  { href: '/about', label: 'About', icon: Info },
]

function linkActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact || href === '/') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<NavUser>(null)
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.success) setUser(d.data)
      })
      .catch(() => {})
  }, [pathname])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [menuOpen])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const logout = async () => {
    setMenuOpen(false)
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    router.push('/')
    router.refresh()
  }

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  return (
    <>
      <nav
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300 h-16',
          scrolled ? 'bg-[#0a0a0a]/95 backdrop-blur-md border-b border-[#2a2a2a]' : 'bg-transparent'
        )}
      >
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
          <div className="hidden md:flex flex-wrap justify-center items-center gap-x-5 gap-y-1 max-w-[min(52rem,calc(100%-11rem))] absolute left-1/2 -translate-x-1/2">
            {NAV_LINKS.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'text-sm font-medium transition-colors whitespace-nowrap',
                  pathname === l.href || (l.href !== '/' && pathname.startsWith(l.href))
                    ? 'text-purple-400'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* Desktop right */}
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
                  type="button"
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

          {/* Mobile: hamburger only (no Sign In / quick icons here) */}
          <div className="flex md:hidden items-center">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="p-2.5 -mr-2 text-gray-300 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              aria-label="Open menu"
              aria-expanded={menuOpen}
            >
              <Menu size={24} strokeWidth={2} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu — bottom sheet */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeMenu}
            aria-label="Close menu"
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[min(88dvh,32rem)] flex flex-col rounded-t-2xl border-t border-[#2a2a2a] bg-[#0f0f0f] shadow-2xl shadow-black/50 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[#1a1a1a] shrink-0">
              <span className="text-sm font-semibold text-white tracking-wide">Menu</span>
              <button
                type="button"
                onClick={closeMenu}
                className="p-2 -mr-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/5"
                aria-label="Close"
              >
                <X size={22} />
              </button>
            </div>

            <nav className="overflow-y-auto flex-1 px-2 py-2">
              <ul className="space-y-0.5">
                {MOBILE_SHEET_LINKS.map(item => {
                  const active = linkActive(pathname, item.href, item.exact)
                  const Icon = item.icon
                  return (
                    <li key={item.href + item.label}>
                      <Link
                        href={item.href}
                        onClick={closeMenu}
                        className={cn(
                          'flex items-center gap-3 px-3 py-3 rounded-xl text-[15px] font-medium transition-colors',
                          active ? 'bg-purple-500/15 text-purple-300' : 'text-gray-200 hover:bg-white/5'
                        )}
                      >
                        <Icon size={20} strokeWidth={active ? 2.2 : 1.8} className="shrink-0 opacity-90" />
                        {item.label}
                      </Link>
                    </li>
                  )
                })}

                {user?.role === 'admin' && (
                  <li>
                    <Link
                      href="/admin"
                      onClick={closeMenu}
                      className={cn(
                        'flex items-center gap-3 px-3 py-3 rounded-xl text-[15px] font-medium transition-colors',
                        pathname.startsWith('/admin') ? 'bg-purple-500/15 text-purple-300' : 'text-gray-200 hover:bg-white/5'
                      )}
                    >
                      <ShieldCheck size={20} className="shrink-0" />
                      Admin
                    </Link>
                  </li>
                )}

                {user && (
                  <li>
                    <Link
                      href="/dashboard"
                      onClick={closeMenu}
                      className={cn(
                        'flex items-center gap-3 px-3 py-3 rounded-xl text-[15px] font-medium transition-colors',
                        pathname === '/dashboard' ? 'bg-purple-500/15 text-purple-300' : 'text-gray-200 hover:bg-white/5'
                      )}
                    >
                      <User size={20} className="shrink-0" />
                      Profile
                    </Link>
                  </li>
                )}
              </ul>
            </nav>

            <div className="shrink-0 border-t border-[#1a1a1a] px-2 pt-2">
              {user ? (
                <button
                  type="button"
                  onClick={logout}
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-[15px] font-medium text-red-400/90 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut size={18} />
                  Log out
                </button>
              ) : (
                <Link
                  href="/login"
                  onClick={closeMenu}
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-[15px] font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
