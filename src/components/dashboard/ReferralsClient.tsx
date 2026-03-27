'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Share2, Copy, Check, QrCode, Star, TrendingUp } from 'lucide-react'
import { buildReferralUrl } from '@/lib/utils'

type User = { referralCode: string; points: number; name: string; _count: { referralsMade: number } }

export default function ReferralsClient() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [qrUrl, setQrUrl] = useState('')

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(async d => {
        if (!d.success) { router.push('/login'); return }
        setUser(d.data)
        // Generate QR for referral link
        const refUrl = buildReferralUrl(d.data.referralCode)
        const qrRes = await fetch(`/api/qr?data=${encodeURIComponent(refUrl)}`).catch(() => null)
        if (qrRes?.ok) {
          const blob = await qrRes.blob()
          setQrUrl(URL.createObjectURL(blob))
        }
      })
      .finally(() => setLoading(false))
  }, [router])

  const copyRef = () => {
    if (!user) return
    navigator.clipboard.writeText(buildReferralUrl(user.referralCode))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading || !user) return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="skeleton h-8 w-48 rounded mb-6" />
      <div className="skeleton h-40 rounded-xl" />
    </div>
  )

  const refUrl = buildReferralUrl(user.referralCode)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white">My Referrals</h1>
        <p className="text-gray-500 text-sm mt-0.5">Share your link — earn 10 points per ticket sold</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { icon: Share2, label: 'Referrals Made', value: user._count.referralsMade, color: 'text-purple-400' },
          { icon: Star, label: 'Points Earned', value: user.points, color: 'text-yellow-400' },
          { icon: TrendingUp, label: 'Est. Value', value: `$${(user.points / 10).toFixed(0)}`, color: 'text-green-400' },
        ].map(s => (
          <div key={s.label} className="stat-card text-center">
            <s.icon size={20} className={`${s.color} mx-auto mb-2`} />
            <div className="text-2xl font-black text-white">{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Referral link card */}
      <div className="card p-6 mb-6">
        <h3 className="font-bold text-white mb-1 flex items-center gap-2">
          <Share2 size={18} className="text-purple-400" />
          Your Referral Link
        </h3>
        <p className="text-gray-500 text-sm mb-4">
          Share this link. When someone buys a ticket through your link, you earn 10 points instantly.
        </p>

        <div className="bg-[#111] rounded-xl p-4 mb-4 font-mono text-sm text-gray-300 break-all border border-[#2a2a2a]">
          {refUrl}
        </div>

        <div className="flex gap-2">
          <button onClick={copyRef} className="flex-1 flex items-center justify-center gap-2 btn-primary text-sm">
            {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Link</>}
          </button>
          <button
            onClick={() => navigator.share?.({ title: 'NXT STOP Events', url: refUrl } as any)}
            className="flex items-center gap-2 border border-[#2a2a2a] rounded-lg px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:border-[#3a3a3a] transition-all"
          >
            <Share2 size={14} />
            Share
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="card p-5">
        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
          <Star size={16} className="text-yellow-400" />
          How Referrals Work
        </h3>
        <div className="space-y-3">
          {[
            { step: '1', text: 'Copy your unique referral link above' },
            { step: '2', text: 'Share it on WhatsApp, Instagram, or anywhere' },
            { step: '3', text: 'When someone buys a ticket through your link, you instantly earn 10 points' },
            { step: '4', text: 'Redeem points for drinks, upgrades, free entry, and more' },
          ].map(s => (
            <div key={s.step} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-purple-400 text-xs font-bold">{s.step}</span>
              </div>
              <p className="text-gray-400 text-sm">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
