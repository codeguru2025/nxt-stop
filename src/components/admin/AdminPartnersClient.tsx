'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from './AdminLayout'
import { Plus, Users, TrendingUp, DollarSign, Loader2, Check, X } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

type Partner = {
  id: string; type: string; businessName?: string; referralCode: string
  commissionRate: number; totalSales: number; totalEarned: number; active: boolean
  user: { name: string; email: string; phone?: string }
  _count: { tickets: number }
  commissions: { amount: number; status: string }[]
}

const PARTNER_TYPES = ['dj', 'influencer', 'pharmacy', 'promoter', 'venue', 'other']

export default function AdminPartnersClient() {
  const router = useRouter()
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '',
    type: 'dj', businessName: '', commissionRate: 10
  })

  const load = () => {
    fetch('/api/admin/partners').then(r => r.json()).then(d => {
      if (d.success) setPartners(d.data)
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
    const res = await fetch('/api/admin/partners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).then(r => r.json())
    setSaving(false)
    if (res.success) { load(); setShowForm(false) }
  }

  const pendingCommissions = (p: Partner) =>
    p.commissions.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0)

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">Partners & Affiliates</h1>
            <p className="text-gray-500 text-sm mt-0.5">{partners.length} active partners</p>
          </div>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 btn-primary text-sm">
            <Plus size={16} />
            Add Partner
          </button>
        </div>

        {showForm && (
          <div className="card p-5 mb-6">
            <h3 className="font-bold text-white mb-4">Add New Partner</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label>Full Name *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="DJ Fire" /></div>
              <div><label>Email *</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="dj@example.com" /></div>
              <div><label>Phone</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+263 77..." /></div>
              <div><label>Password *</label><input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 8 characters" /></div>
              <div>
                <label>Partner Type *</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {PARTNER_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                </select>
              </div>
              <div><label>Business Name</label><input value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} placeholder="DJ Fire Entertainment" /></div>
              <div>
                <label>Commission Rate (%)</label>
                <input type="number" min={0} max={50} value={form.commissionRate} onChange={e => setForm(f => ({ ...f, commissionRate: parseFloat(e.target.value) }))} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={save} disabled={saving || !form.name || !form.email || !form.password} className="btn-primary flex items-center gap-2 text-sm">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Create Partner
              </button>
              <button onClick={() => setShowForm(false)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-white border border-[#2a2a2a] rounded-lg px-3 py-2">
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        )}

        {/* Summary KPIs */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Partners', value: partners.length, icon: Users, color: 'text-purple-400' },
            { label: 'Total Sales', value: partners.reduce((s, p) => s + p.totalSales, 0), icon: TrendingUp, color: 'text-green-400' },
            { label: 'Commissions Owed', value: formatCurrency(partners.reduce((s, p) => s + pendingCommissions(p), 0)), icon: DollarSign, color: 'text-yellow-400' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <s.icon size={20} className={`${s.color} mb-2`} />
              <div className="text-2xl font-black text-white">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Partners table */}
        {loading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[#2a2a2a]">
                  <tr className="text-xs text-gray-500">
                    <th className="text-left p-4">Partner</th>
                    <th className="text-left p-4">Type</th>
                    <th className="text-left p-4">Referral Code</th>
                    <th className="text-left p-4">Commission</th>
                    <th className="text-left p-4">Sales</th>
                    <th className="text-left p-4">Earned</th>
                    <th className="text-left p-4">Pending</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a1a]">
                  {partners.map(p => (
                    <tr key={p.id} className="hover:bg-white/2">
                      <td className="p-4">
                        <div className="font-medium text-white">{p.user.name}</div>
                        <div className="text-xs text-gray-500">{p.user.email}</div>
                      </td>
                      <td className="p-4">
                        <span className="capitalize text-gray-300 bg-[#2a2a2a] rounded-md px-2 py-0.5 text-xs">{p.type}</span>
                      </td>
                      <td className="p-4 font-mono text-purple-400 text-xs">{p.referralCode}</td>
                      <td className="p-4 text-gray-300">{p.commissionRate}%</td>
                      <td className="p-4 font-bold text-white">{p.totalSales}</td>
                      <td className="p-4 text-green-400">{formatCurrency(p.totalEarned)}</td>
                      <td className="p-4 text-yellow-400">{formatCurrency(pendingCommissions(p))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {partners.length === 0 && (
                <div className="text-center py-12 text-gray-600">No partners yet.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
