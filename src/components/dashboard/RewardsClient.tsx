'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Star, Gift, Check, Loader2, AlertCircle } from 'lucide-react'

type Reward = {
  id: string; name: string; description?: string; type: string
  pointsCost: number; stock?: number; image?: string; active: boolean
}

type User = { points: number; name: string }

const REWARD_ICONS: Record<string, string> = {
  free_drink: '🍻',
  discounted_ticket: '🎫',
  free_entry: '🎟️',
  bring_friend: '👫',
  vip_upgrade: '⭐',
  merchandise: '👕',
}

export default function RewardsClient() {
  const router = useRouter()
  const [rewards, setRewards] = useState<Reward[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [redeeming, setRedeeming] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()),
      fetch('/api/rewards').then(r => r.json()),
    ]).then(([userRes, rwRes]) => {
      if (!userRes.success) { router.push('/login'); return }
      setUser(userRes.data)
      if (rwRes.success) setRewards(rwRes.data)
    }).finally(() => setLoading(false))
  }, [router])

  const redeem = async (rewardId: string) => {
    setRedeeming(rewardId)
    setError('')

    const res = await fetch('/api/rewards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rewardId }),
    }).then(r => r.json())

    setRedeeming(null)

    if (res.success) {
      setSuccess(rewardId)
      // Refresh points
      fetch('/api/auth/me').then(r => r.json()).then(d => {
        if (d.success) setUser(d.data)
      })
      setTimeout(() => setSuccess(null), 3000)
    } else {
      setError(res.error ?? 'Failed to redeem')
    }
  }

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="skeleton h-8 w-48 rounded mb-6" />
      <div className="grid sm:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-40 rounded-xl" />)}
      </div>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white mb-1">Rewards Shop</h1>
        <p className="text-gray-500 text-sm">Redeem your points for exclusive perks</p>
      </div>

      {/* Points balance */}
      <div className="bg-gradient-to-r from-yellow-900/30 to-orange-900/20 border border-yellow-500/20 rounded-2xl p-5 mb-8 flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-400">Your balance</div>
          <div className="text-4xl font-black text-white flex items-center gap-2">
            <Star size={28} className="text-yellow-400" />
            {user?.points ?? 0} <span className="text-yellow-400 text-2xl">points</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Earn more by</div>
          <div className="text-sm text-gray-300 font-medium">referring friends</div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-5 text-sm text-red-400">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Rewards grid */}
      <div className="grid sm:grid-cols-2 gap-4">
        {rewards.map(reward => {
          const canAfford = (user?.points ?? 0) >= reward.pointsCost
          const isRedeeming = redeeming === reward.id
          const isSuccess = success === reward.id
          const outOfStock = reward.stock !== undefined && reward.stock !== null && reward.stock <= 0

          return (
            <div
              key={reward.id}
              className={`card p-5 transition-all ${canAfford && !outOfStock ? 'hover:border-yellow-500/30' : 'opacity-60'}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="text-4xl">{REWARD_ICONS[reward.type] ?? '🎁'}</div>
                <div className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-2.5 py-1">
                  <Star size={12} className="text-yellow-400" />
                  <span className="text-yellow-300 text-sm font-bold">{reward.pointsCost}</span>
                </div>
              </div>

              <h3 className="font-bold text-white mb-1">{reward.name}</h3>
              {reward.description && <p className="text-gray-500 text-sm mb-4">{reward.description}</p>}

              {reward.stock !== null && reward.stock !== undefined && (
                <div className="text-xs text-gray-600 mb-3">{reward.stock} left in stock</div>
              )}

              <button
                onClick={() => canAfford && !outOfStock && !isRedeeming && redeem(reward.id)}
                disabled={!canAfford || outOfStock || isRedeeming || isSuccess}
                className={`w-full rounded-xl py-2.5 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  isSuccess
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : canAfford && !outOfStock
                    ? 'bg-yellow-500 hover:bg-yellow-400 text-black'
                    : 'bg-[#2a2a2a] text-gray-600 cursor-not-allowed'
                }`}
              >
                {isRedeeming ? (
                  <><Loader2 size={14} className="animate-spin" /> Redeeming...</>
                ) : isSuccess ? (
                  <><Check size={14} /> Redeemed!</>
                ) : outOfStock ? (
                  'Out of Stock'
                ) : !canAfford ? (
                  `Need ${reward.pointsCost - (user?.points ?? 0)} more pts`
                ) : (
                  <><Gift size={14} /> Redeem</>
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
