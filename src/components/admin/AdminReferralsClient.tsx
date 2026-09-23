'use client'

import { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout'
import { Share2, Check, X, Loader2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

type Reward = {
  id: string
  amount: number
  status: string
  createdAt: string
  paidAt: string | null
  user: { id: string; name: string; phone: string }
  referral: { id: string; targetUserId: string }
}

export default function AdminReferralsClient() {
  const [rewards, setRewards] = useState<Reward[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'paid' | 'cancelled' | 'all'>('pending')
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    const qs = filter === 'all' ? '' : `?status=${filter}`
    fetch(`/api/admin/referral-rewards${qs}`)
      .then(r => r.json())
      .then(d => { if (d.success) setRewards(d.data) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter])

  const setStatus = async (id: string, status: 'paid' | 'cancelled') => {
    setBusy(id)
    const res = await fetch(`/api/admin/referral-rewards/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).then(r => r.json())
    setBusy(null)
    if (res.success) setRewards(prev => prev.filter(r => r.id !== id))
  }

  const totalShown = rewards.reduce((s, r) => s + Number(r.amount), 0)

  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              <Share2 size={20} className="text-purple-400" />
              Referral Rewards
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">10% cash payouts earned by customer referrals</p>
          </div>
          <div className="flex gap-1.5">
            {(['pending', 'paid', 'cancelled', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-lg capitalize transition-colors ${
                  filter === f ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-gray-500 border border-[#2a2a2a] hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <p className="text-gray-500 text-sm mb-4">{rewards.length} reward{rewards.length !== 1 ? 's' : ''} · {formatCurrency(totalShown)} total</p>

        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
          </div>
        ) : rewards.length === 0 ? (
          <div className="card p-10 text-center">
            <Share2 size={40} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No {filter !== 'all' ? filter : ''} referral rewards</p>
          </div>
        ) : (
          <div className="card divide-y divide-[#2a2a2a] overflow-hidden">
            {rewards.map(r => (
              <div key={r.id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-white font-semibold">{r.user.name}</div>
                  <div className="text-gray-600 text-xs">{r.user.phone} · {formatDate(r.createdAt)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-green-400 font-bold">{formatCurrency(r.amount)}</div>
                  {r.status === 'pending' ? (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setStatus(r.id, 'paid')}
                        disabled={busy === r.id}
                        className="flex items-center gap-1 bg-green-500/15 hover:bg-green-500/25 text-green-400 border border-green-500/20 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all disabled:opacity-50"
                      >
                        {busy === r.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Mark Paid
                      </button>
                      <button
                        onClick={() => setStatus(r.id, 'cancelled')}
                        disabled={busy === r.id}
                        className="flex items-center gap-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all disabled:opacity-50"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-600 capitalize">{r.status}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
