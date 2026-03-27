'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Ticket, Star, Share2, Copy, Check, QrCode, ArrowRight, Gift } from 'lucide-react'
import { buildReferralUrl, formatCurrency } from '@/lib/utils'

type User = {
  id: string; name: string; email: string; role: string
  referralCode: string; points: number; totalEarned: number
  _count: { tickets: number; referralsMade: number; redemptions: number }
}

export default function DashboardClient() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (!d.success) { router.push('/login'); return }
        setUser(d.data)
      })
      .finally(() => setLoading(false))
  }, [router])

  const copyRef = () => {
    if (!user) return
    navigator.clipboard.writeText(buildReferralUrl(user.referralCode))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white">Hey, {user.name.split(' ')[0]} 👋</h1>
        <p className="text-gray-500 mt-0.5">Here's your NXT STOP dashboard</p>
      </div>

      {/* Stats grid */}
      <div className="grid sm:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Ticket, label: 'My Tickets', value: user._count.tickets, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { icon: Star, label: 'Points', value: user.points, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
          { icon: Share2, label: 'Referrals', value: user._count.referralsMade, color: 'text-green-400', bg: 'bg-green-500/10' },
          { icon: Gift, label: 'Redeemed', value: user._count.redemptions, color: 'text-pink-400', bg: 'bg-pink-500/10' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
              <s.icon size={18} className={s.color} />
            </div>
            <div className="text-2xl font-black text-white">{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

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

      {/* Referral link */}
      <div className="card p-5 mb-6">
        <h3 className="font-bold text-white mb-1 flex items-center gap-2">
          <QrCode size={18} className="text-purple-400" />
          Your Referral Link
        </h3>
        <p className="text-gray-500 text-sm mb-4">Share this — earn 10 points for every friend who buys a ticket</p>

        <div className="flex gap-2">
          <div className="flex-1 bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-gray-400 truncate font-mono">
            {refUrl}
          </div>
          <button
            onClick={copyRef}
            className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-all shrink-0"
          >
            {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
          </button>
        </div>
      </div>

      {/* Quick nav */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { href: '/dashboard/tickets', icon: Ticket, label: 'My Tickets', desc: 'View and download your tickets' },
          { href: '/dashboard/referrals', icon: Share2, label: 'Referrals', desc: 'Track your referral performance' },
          { href: '/dashboard/rewards', icon: Gift, label: 'Rewards', desc: 'Redeem your points for prizes' },
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
