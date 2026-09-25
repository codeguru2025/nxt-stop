'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, CalendarDays, Users, Package,
  Gift, UserCircle2, QrCode, LogOut, Shield,
  ImageIcon, Video, Ticket, Menu, X, KeyRound, Lock, ScrollText, Share2, UsersRound, ShieldCheck, Check
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FEATURES } from '@/lib/features'
import type { AdminCapability } from '@/lib/adminCapabilities'
import AdminPushToggle from './AdminPushToggle'

const NAV: { href: string; icon: typeof LayoutDashboard; label: string; exact?: boolean; capability?: AdminCapability; ownerOnly?: boolean }[] = [
  { href: '/admin',           icon: LayoutDashboard, label: 'Overview',       exact: true, capability: 'stats' },
  { href: '/admin/approvals', icon: ShieldCheck,     label: 'Approvals' }, // every admin — approving is how serious changes go live
  { href: '/admin/events',    icon: CalendarDays,    label: 'Events',                      capability: 'events' },
  { href: '/admin/partners',  icon: Users,           label: 'Partners',                    capability: 'partners' },
  { href: '/admin/store',     icon: Package,         label: 'Store',                       capability: 'store' },
  ...(FEATURES.points ? [{ href: '/admin/rewards', icon: Gift, label: 'Rewards', capability: 'rewards' as const }] : []),
  { href: '/admin/referrals', icon: Share2,          label: 'Referrals',                   capability: 'referrals' },
  { href: '/admin/teams',     icon: UsersRound,      label: 'Teams',                       capability: 'teams' },
  { href: '/admin/founders',  icon: UserCircle2,     label: 'Founders',                    capability: 'founders' },
  { href: '/admin/tickets',    icon: Ticket,          label: 'Tickets & Orders',           capability: 'tickets' },
  { href: '/admin/gallery',    icon: ImageIcon,       label: 'Gallery',                    capability: 'gallery' },
  { href: '/admin/videos',     icon: Video,           label: 'Past Videos',                capability: 'videos' },
  { href: '/admin/gate-staff',       icon: Users,     label: 'Gate Staff',                 capability: 'gate_staff' },
  { href: '/admin/admins',            icon: Shield,    label: 'Admins',                    capability: 'admins' },
  { href: '/admin/password-resets',   icon: KeyRound,  label: 'Password Resets',           capability: 'password_resets' },
  { href: '/admin/audit-log',         icon: ScrollText, label: 'Audit Log',                ownerOnly: true },
  { href: '/gate',                    icon: QrCode,    label: 'Gate Scanner' }, // shared with gate_staff role, not capability-gated
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [pendingResets, setPendingResets] = useState(0)
  const [capabilities, setCapabilities] = useState<AdminCapability[] | null>(null)
  const [isPlatformOwner, setIsPlatformOwner] = useState(false)
  const [waitingOnMe, setWaitingOnMe] = useState(0)
  const [approvalNotice, setApprovalNotice] = useState<string | null>(null)

  // Approvals badge — refreshed every minute and whenever a decision is made
  useEffect(() => {
    const load = () => fetch('/api/admin/approvals').then(r => r.json()).then(d => { if (d.success) setWaitingOnMe(d.data.waitingOnMe) }).catch(() => {})
    load()
    const id = setInterval(load, 60_000)
    window.addEventListener('nxt:approvals-changed', load)
    return () => { clearInterval(id); window.removeEventListener('nxt:approvals-changed', load) }
  }, [])

  // Green notice when something this admin saved was held for approval (see CsrfProvider)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined
    const onPending = (e: Event) => {
      setApprovalNotice((e as CustomEvent<string>).detail)
      if (t) clearTimeout(t)
      t = setTimeout(() => setApprovalNotice(null), 9000)
    }
    window.addEventListener('nxt:approval-pending', onPending)
    return () => { window.removeEventListener('nxt:approval-pending', onPending); if (t) clearTimeout(t) }
  }, [])

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.success && d.data.role === 'admin') {
        setCapabilities(d.data.capabilities ?? [])
        setIsPlatformOwner(!!d.data.isPlatformOwner)
      }
    })
  }, [])

  useEffect(() => {
    if (!capabilities?.includes('password_resets')) return
    fetch('/api/admin/password-resets')
      .then(r => r.json())
      .then(d => { if (d.success) setPendingResets(d.data.length) })
      .catch(() => {})
  }, [capabilities])

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/'
  }

  const visibleNav = capabilities
    ? NAV.filter(item => {
        if (item.ownerOnly) return isPlatformOwner
        return !item.capability || capabilities.includes(item.capability)
      })
    : NAV.filter(item => !item.ownerOnly)

  const currentNavItem = NAV.find(item => item.exact ? pathname === item.href : pathname.startsWith(item.href))
  const denied = !!capabilities && !!currentNavItem?.capability && !capabilities.includes(currentNavItem.capability)

  return (
    <div className="min-h-screen flex bg-[#0a0a0a]">

      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/70 z-30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'w-60 bg-[#111] border-r border-[#2a2a2a] fixed inset-y-0 left-0 z-40 flex flex-col transition-transform duration-300 ease-in-out',
        open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}>
        {/* Logo */}
        <div className="p-5 border-b border-[#2a2a2a] flex items-center justify-between gap-2 min-h-[64px]">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <img
              src="https://nxtstop-uploads.lon1.cdn.digitaloceanspaces.com/nxt-stop%20logo%20png.png"
              alt="NXT STOP"
              className="h-6 w-auto object-contain invert shrink-0"
            />
            <span className="text-xs bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-md font-medium ml-auto shrink-0">Admin</span>
          </div>
          {/* Close button — mobile only */}
          <button
            onClick={() => setOpen(false)}
            className="md:hidden shrink-0 text-gray-500 hover:text-white transition-colors ml-1"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {visibleNav.map(item => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  active
                    ? 'bg-purple-500/15 text-purple-300 border border-purple-500/20'
                    : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'
                )}
              >
                <item.icon size={16} className="shrink-0" />
                <span className="truncate flex-1">{item.label}</span>
                {item.href === '/admin/approvals' && waitingOnMe > 0 && (
                  <span className="ml-auto bg-purple-500 text-white text-xs font-black rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                    {waitingOnMe}
                  </span>
                )}
                {item.href === '/admin/password-resets' && pendingResets > 0 && (
                  <span className="ml-auto bg-yellow-500 text-black text-xs font-black rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                    {pendingResets}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-[#2a2a2a]">
          <AdminPushToggle />
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-200 hover:bg-white/5 transition-all mb-1"
          >
            <Shield size={16} className="shrink-0" />
            View Site
          </Link>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:text-red-400 hover:bg-red-500/5 transition-all"
          >
            <LogOut size={16} className="shrink-0" />
            Logout
          </button>
        </div>
      </aside>

      {/* Page content */}
      <div className="flex flex-col flex-1 md:ml-60 min-h-screen min-w-0">

        {approvalNotice && (
          <div role="status" className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 bg-[#0f1f14] border border-green-500/30 text-green-200 rounded-2xl p-4 shadow-2xl flex items-start gap-3">
            <Check size={18} className="text-green-400 shrink-0 mt-0.5" />
            <div className="text-sm flex-1">
              {approvalNotice}{' '}
              <Link href="/admin/approvals" className="underline text-green-300 whitespace-nowrap">View approvals</Link>
            </div>
            <button onClick={() => setApprovalNotice(null)} className="text-green-400/70 hover:text-green-200" aria-label="Dismiss"><X size={16} /></button>
          </div>
        )}

        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-20 bg-[#111] border-b border-[#2a2a2a] px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => setOpen(true)}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Open sidebar"
          >
            <Menu size={22} />
          </button>
          <img
            src="https://nxtstop-uploads.lon1.cdn.digitaloceanspaces.com/nxt-stop%20logo%20png.png"
            alt="NXT STOP"
            className="h-6 w-auto object-contain invert"
          />
        </header>

        <main className="flex-1 w-full overflow-x-hidden">
          {denied ? (
            <div className="flex items-center justify-center min-h-[60vh] p-6">
              <div className="card p-8 text-center max-w-sm">
                <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                  <Lock size={24} className="text-red-400" />
                </div>
                <h3 className="font-bold text-white mb-1">Access Restricted</h3>
                <p className="text-gray-500 text-sm">
                  Your admin account doesn&apos;t have access to this section. Ask another admin to grant it from the Admins page.
                </p>
              </div>
            </div>
          ) : children}
        </main>
      </div>
    </div>
  )
}
