'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from './AdminLayout'
import { Plus, Gift, Star, Loader2, Check, X } from 'lucide-react'

type Reward = {
  id: string; name: string; description?: string; type: string
  pointsCost: number; stock?: number; active: boolean
  _count: { redemptions: number }
}

const TYPES = ['free_drink', 'discounted_ticket', 'free_entry', 'bring_friend', 'vip_upgrade', 'merchandise']
const ICONS: Record<string, string> = {
  free_drink: '🍻', discounted_ticket: '🎫', free_entry: '🎟️',
  bring_friend: '👫', vip_upgrade: '⭐', merchandise: '👕'
}

export default function AdminRewardsClient() {
  const router = useRouter()
  const [rewards, setRewards] = useState<Reward[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', type: 'free_drink', pointsCost: 50, stock: '' })

  const load = () => {
    fetch('/api/admin/rewards').then(r => r.json()).then(d => {
      if (d.success) setRewards(d.data)
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.success || d.data.role !== 'admin') { router.push('/login'); return }
      load()
    })
  }, [router])

  const save = async () => {
    setSaving(true)
    const res = await fetch('/api/admin/rewards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        stock: form.stock ? parseInt(form.stock) : null,
      }),
    }).then(r => r.json())
    setSaving(false)
    if (res.success) { load(); setShowForm(false) }
  }

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">Rewards Program</h1>
            <p className="text-gray-500 text-sm mt-0.5">Configure the points redemption catalog</p>
          </div>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 btn-primary text-sm">
            <Plus size={16} />
            Add Reward
          </button>
        </div>

        {showForm && (
          <div className="card p-5 mb-6">
            <h3 className="font-bold text-white mb-4">New Reward</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label>Reward Name *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Free Drink" /></div>
              <div>
                <label>Type *</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div><label>Points Cost *</label><input type="number" value={form.pointsCost} onChange={e => setForm(f => ({ ...f, pointsCost: parseInt(e.target.value) }))} /></div>
              <div><label>Stock (blank = unlimited)</label><input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} placeholder="Leave blank for unlimited" /></div>
              <div className="sm:col-span-2"><label>Description</label><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description shown to users" /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={save} disabled={saving || !form.name} className="btn-primary flex items-center gap-2 text-sm">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Create Reward
              </button>
              <button onClick={() => setShowForm(false)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-white border border-[#2a2a2a] rounded-lg px-3 py-2">
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-36 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rewards.map(r => (
              <div key={r.id} className={`card p-5 ${!r.active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="text-3xl">{ICONS[r.type] ?? '🎁'}</div>
                  <div className="flex items-center gap-1 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-2 py-0.5">
                    <Star size={11} className="text-yellow-400" />
                    <span className="text-yellow-300 text-sm font-bold">{r.pointsCost}</span>
                  </div>
                </div>
                <div className="font-bold text-white mb-1">{r.name}</div>
                {r.description && <div className="text-gray-500 text-sm mb-3">{r.description}</div>}
                <div className="flex items-center justify-between text-xs text-gray-600 pt-3 border-t border-[#2a2a2a]">
                  <span>{r._count.redemptions} redeemed</span>
                  <span>{r.stock !== null && r.stock !== undefined ? `${r.stock} left` : '∞ stock'}</span>
                </div>
              </div>
            ))}
            {rewards.length === 0 && (
              <div className="sm:col-span-3 text-center py-12 text-gray-600">
                <Gift size={32} className="mx-auto mb-2 opacity-30" />
                No rewards configured yet.
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
