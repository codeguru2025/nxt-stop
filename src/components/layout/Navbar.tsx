'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Menu, X, Ticket, User, LogOut, LayoutDashboard, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

type NavUser = { name: string; role: string; email: string } | null

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
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
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    router.push('/')
    router.refresh()
  }

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/events', label: 'Events' },
    { href: '/merch', label: 'Merch' },
    { href: '/gallery', label: 'Gallery' },
    { href: '/about', label: 'About' },
  ]

  return (
    <nav className={cn(
      'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
      scrolled ? 'bg-[#0a0a0a]/95 backdrop-blur-md border-b border-[#2a2a2a]' : 'bg-transparent'
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <img
              src="https://nxt-stop.lon1.cdn.digitaloceanspaces.com/nxt-stop%20logo.jpeg"
              alt="NXT STOP"
              className="h-9 w-auto object-contain"
            />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map(l => (
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

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                {(user.role === 'admin') && (
                  <Link href="/admin" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-purple-400 transition-colors">
                    <ShieldCheck size={16} />
                    Admin
                  </Link>
                )}
                <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors">
                  <LayoutDashboard size={16} />
                  Dashboard
                </Link>
                <Link href="/dashboard/tickets" className="flex items-center gap-1.5 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-gray-300 hover:border-purple-500/50 transition-all">
                  <Ticket size={14} />
                  My Tickets
                </Link>
                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-400 transition-colors"
                >
                  <LogOut size={14} />
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

          {/* Mobile menu button */}
          <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setOpen(!open)}>
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-[#111] border-t border-[#2a2a2a] px-4 py-4 flex flex-col gap-3">
          {navLinks.map(l => (
            <Link key={l.href} href={l.href} className="text-gray-300 hover:text-white py-2 font-medium" onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
          <div className="border-t border-[#2a2a2a] pt-3 flex flex-col gap-2">
            {user ? (
              <>
                <Link href="/dashboard" className="text-gray-300 hover:text-white py-2" onClick={() => setOpen(false)}>Dashboard</Link>
                {user.role === 'admin' && (
                  <Link href="/admin" className="text-purple-400 py-2" onClick={() => setOpen(false)}>Admin Panel</Link>
                )}
                <button onClick={logout} className="text-left text-red-400 py-2">Logout</button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-gray-300 py-2" onClick={() => setOpen(false)}>Sign In</Link>
                <Link href="/register" className="bg-purple-600 text-white rounded-lg px-4 py-2 text-center font-medium" onClick={() => setOpen(false)}>Get Tickets</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
