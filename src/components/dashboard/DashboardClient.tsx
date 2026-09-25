'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Ticket, Star, Share2, Copy, Check, QrCode, ArrowRight, Gift, Receipt, UserCog, DollarSign, Mic2 } from 'lucide-react'
import { buildReferralUrl, formatCurrency, formatDate } from '@/lib/utils'
import { FEATURES } from '@/lib/features'

type User = {
  id: string; name: string; phone: string; role: string
  referralCode: string; points: number; totalEarned: number
  eventParticipations: { role: string; event: { name: string; slug: string; date: string } }[]
  _count: { tickets: number; referralsMade: number; redemptions: number }
}

export default function DashboardClient() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [earned, setEarned] = useState(0)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (!d.success) { router.push('/login'); return }
        setUser(d.data)
      })
      .finally(() => setLoading(false))

    fetch('/api/dashboard/referrals')
      .then(r => r.json())
      .then(d => { if (d.success) setEarned(d.data.totals.pending + d.data.totals.paid) })
      .catch(() => {})
  }, [router])

  const copy = (key: string, url: string) => {
    navigator.clipboard.writeText(url)
    setCopied(key)
    setTimeout(() => setCopied(c => (c === key ? null : c)), 2000)
  }

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="skeleton h-8 w-48 rounded mb-6" />
      <div className="grid sm:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
      </div>
    </div>
  )

  if (!user) return null

  const refUrl = buildReferralUrl(user.referralCode)
  const stats = FEATURES.points
    ? [
        { icon: Ticket, label: 'My Tickets', value: user._count.tickets, color: 'text-purple-400', bg: 'bg-purple-500/10' },
        { icon: Star, label: 'Points', value: user.points, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
        { icon: Share2, label: 'Referrals', value: user._count.referralsMade, color: 'text-green-400', bg: 'bg-green-500/10' },
        { icon: Gift, label: 'Redeemed', value: user._count.redemptions, color: 'text-pink-400', bg: 'bg-pink-500/10' },
      ]
    : [
        { icon: Ticket, label: 'My Tickets', value: user._count.tickets, color: 'text-purple-400', bg: 'bg-purple-500/10' },
        { icon: Share2, label: 'Sales Through My Link', value: user._count.referralsMade, color: 'text-green-400', bg: 'bg-green-500/10' },
        { icon: DollarSign, label: 'Earned From My Link', value: formatCurrency(earned), color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
      ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white">Hey, {user.name.split(' ')[0]} 👋</h1>
        <p className="text-gray-500 mt-0.5">Here&apos;s your NXT STOP dashboard</p>
      </div>

      {/* Stats grid */}
      <div className={`grid ${FEATURES.points ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-4 mb-8`}>
        {stats.map(s => (
          <div key={s.label} className="stat-card">
            <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
              <s.icon size={18} className={s.color} />
            </div>
            <div className="text-2xl font-black text-white">{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {FEATURES.points && (
        <>
          {/* Points banner */}
          <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/20 border border-purple-500/20 rounded-2xl p-5 mb-6 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-gray-400 mb-1">Your Points Balance</div>
              <div className="text-4xl font-black text-white">{user.points} <span className="text-purple-400 text-2xl">pts</span></div>
              <div className="text-xs text-gray-500 mt-1">Total earned: {user.totalEarned} pts</div>
            </div>
            <Link href="/dashboard/rewards" className="btn-primary text-sm whitespace-nowrap flex items-center gap-1.5">
              Redeem Rewards <ArrowRight size={14} />
            </Link>
          </div>

          {/* Merch milestone progress */}
          {(() => {
            const MERCH_THRESHOLD = 300
            const pts = user.points
            const pct = Math.min(Math.round((pts / MERCH_THRESHOLD) * 100), 100)
            const remaining = Math.max(MERCH_THRESHOLD - pts, 0)
            return (
              <div className="card p-5 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">👕</span>
                    <span className="text-sm font-bold text-white">Merch Milestone</span>
                  </div>
                  <span className="text-xs text-yellow-400 font-bold">{pts} / {MERCH_THRESHOLD} pts</span>
                </div>
                <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: pct >= 100 ? '#22c55e' : 'linear-gradient(to right, #a855f7, #f59e0b)' }}
                  />
                </div>
                {remaining > 0 ? (
                  <p className="text-xs text-gray-500">
                    <span className="text-yellow-400 font-semibold">{remaining} more pts</span> to unlock merchandise rewards — earn 10 pts per referral ticket sale
                  </p>
                ) : (
                  <p className="text-xs text-green-400 font-semibold">🎉 You can redeem merch! Head to the Rewards Shop.</p>
                )}
              </div>
            )
          })()}
        </>
      )}

      {/* Line-up spots — a link per event that lands fans straight on it */}
      {user.eventParticipations.length > 0 && (
        <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/20 border border-purple-500/20 rounded-2xl p-5 mb-6">
          <h3 className="font-bold text-white mb-1 flex items-center gap-2">
            <Mic2 size={18} className="text-purple-400" />
            You&apos;re on the line-up
          </h3>
          <p className="text-gray-400 text-sm mb-4">Share your link for each show with your fans — you earn 10% of everything bought through it.</p>
          <div className="space-y-3">
            {user.eventParticipations.map(p => {
              const url = buildReferralUrl(user.referralCode, p.event.slug)
              return (
                <div key={p.event.slug}>
                  <div className="text-sm text-white font-semibold">{p.event.name}</div>
                  <div className="text-xs text-gray-500 mb-1.5">{formatDate(p.event.date)}</div>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-gray-400 truncate font-mono">{url}</div>
                    <button
                      onClick={() => copy(p.event.slug, url)}
                      className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg px-3 py-2 text-xs font-medium transition-all shrink-0"
                    >
                      {copied === p.event.slug ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Referral link */}
      <div className="card p-5 mb-6">
        <h3 className="font-bold text-white mb-1 flex items-center gap-2">
          <QrCode size={18} className="text-purple-400" />
          Your Referral Link
        </h3>
        <p className="text-gray-500 text-sm mb-4">
          Share this — earn <span className="text-yellow-400 font-semibold">10%</span> of everything your friends buy through it
        </p>

        <div className="flex gap-2">
          <div className="flex-1 bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-gray-400 truncate font-mono">
            {refUrl}
          </div>
          <button
            onClick={() => copy('main', refUrl)}
            className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-all shrink-0"
          >
            {copied === 'main' ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
          </button>
        </div>
      </div>

      {/* Quick nav */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { href: '/dashboard/tickets', icon: Ticket, label: 'My Tickets', desc: 'View and download your tickets' },
          { href: '/dashboard/referrals', icon: Share2, label: 'Referrals', desc: 'Track your link and earnings' },
          ...(FEATURES.points ? [{ href: '/dashboard/rewards', icon: Gift, label: 'Rewards', desc: 'Redeem your points for prizes' }] : []),
          { href: '/dashboard/purchases', icon: Receipt, label: 'My Purchases', desc: 'Drink vouchers, tables, merch & order history' },
          { href: '/dashboard/account', icon: UserCog, label: 'My Account', desc: 'Edit your details and change your password' },
        ].map(nav => (
          <Link key={nav.href} href={nav.href} className="card p-4 hover:border-[#3a3a3a] transition-all group hover:-translate-y-0.5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <nav.icon size={18} className="text-purple-400" />
              </div>
              <span className="font-semibold text-white group-hover:text-purple-300 transition-colors">{nav.label}</span>
            </div>
            <p className="text-sm text-gray-500">{nav.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
