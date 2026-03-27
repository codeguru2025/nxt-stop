'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, CalendarDays, Users, Package,
  Gift, UserCircle2, BarChart3, QrCode, LogOut, Shield
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/admin', icon: LayoutDashboard, label: 'Overview', exact: true },
  { href: '/admin/events', icon: CalendarDays, label: 'Events' },
  { href: '/admin/partners', icon: Users, label: 'Partners' },
  { href: '/admin/store', icon: Package, label: 'Store' },
  { href: '/admin/rewards', icon: Gift, label: 'Rewards' },
  { href: '/admin/founders', icon: UserCircle2, label: 'Founders' },
  { href: '/gate', icon: QrCode, label: 'Gate Scanner' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-60 bg-[#111] border-r border-[#2a2a2a] fixed inset-y-0 left-0 z-40 flex flex-col">
        {/* Logo */}
        <div className="p-5 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center">
              <span className="text-white font-black text-xs">N</span>
            </div>
            <span className="font-black text-white text-sm">NXT STOP</span>
            <span className="text-xs bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-md font-medium ml-auto">Admin</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map(item => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  active
                    ? 'bg-purple-500/15 text-purple-300 border border-purple-500/20'
                    : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'
                )}
              >
                <item.icon size={16} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-[#2a2a2a]">
          <Link href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-200 hover:bg-white/5 transition-all mb-1">
            <Shield size={16} />
            View Site
          </Link>
          <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:text-red-400 hover:bg-red-500/5 transition-all">
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-60 min-h-screen">
        {children}
      </main>
    </div>
  )
}
