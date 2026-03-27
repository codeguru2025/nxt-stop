'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from './AdminLayout'
import { Plus, AlertTriangle, Package, Loader2, Check, X } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

type Product = {
  id: string; name: string; price: number; stock: number; sold: number
  category: string; active: boolean; lowStockAt: number; description?: string
  event: { name: string }
}

type Event = { id: string; name: string }

const CATEGORIES = ['drink', 'food', 'merchandise', 'other']

export default function AdminStoreClient() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ eventId: '', name: '', description: '', price: 0, stock: 50, category: 'drink', lowStockAt: 10 })

  const load = () => {
    Promise.all([
      fetch('/api/admin/products').then(r => r.json()),
      fetch('/api/admin/events').then(r => r.json()),
    ]).then(([prodRes, evRes]) => {
      if (prodRes.success) setProducts(prodRes.data)
      if (evRes.success) setEvents(evRes.data)
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
    const res = await fetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).then(r => r.json())
    setSaving(false)
    if (res.success) { load(); setShowForm(false) }
  }

  const lowStock = products.filter(p => p.stock <= p.lowStockAt && p.active)

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">Event Store</h1>
            <p className="text-gray-500 text-sm mt-0.5">{products.length} products across all events</p>
          </div>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 btn-primary text-sm">
            <Plus size={16} />
            Add Product
          </button>
        </div>

        {/* Low stock alerts */}
        {lowStock.length > 0 && (
          <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-orange-400" />
              <span className="font-semibold text-orange-300 text-sm">{lowStock.length} product{lowStock.length > 1 ? 's' : ''} running low</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {lowStock.map(p => (
                <div key={p.id} className="bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-1.5 text-xs">
                  <span className="text-white font-medium">{p.name}</span>
                  <span className="text-orange-400 ml-2">{p.stock} left</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add form */}
        {showForm && (
          <div className="card p-5 mb-6">
            <h3 className="font-bold text-white mb-4">Add Product</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label>Event *</label>
                <select value={form.eventId} onChange={e => setForm(f => ({ ...f, eventId: e.target.value }))}>
                  <option value="">Select event...</option>
                  {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                </select>
              </div>
              <div><label>Product Name *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Heineken" /></div>
              <div>
                <label>Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                </select>
              </div>
              <div><label>Price ($)</label><input type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) }))} /></div>
              <div><label>Initial Stock</label><input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: parseInt(e.target.value) }))} /></div>
              <div><label>Low Stock Alert At</label><input type="number" value={form.lowStockAt} onChange={e => setForm(f => ({ ...f, lowStockAt: parseInt(e.target.value) }))} /></div>
              <div className="sm:col-span-2"><label>Description</label><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={save} disabled={saving || !form.eventId || !form.name} className="btn-primary flex items-center gap-2 text-sm">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Add Product
              </button>
              <button onClick={() => setShowForm(false)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-white border border-[#2a2a2a] rounded-lg px-3 py-2">
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        )}

        {/* Products grid */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-32 rounded-xl" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🛒</div>
            <p className="text-gray-500">No products yet.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map(p => {
              const isLow = p.stock <= p.lowStockAt
              return (
                <div key={p.id} className={`card p-4 transition-all ${!p.active ? 'opacity-50' : ''}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Package size={14} className="text-gray-500" />
                        <span className="font-semibold text-white">{p.name}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 capitalize">{p.category} · {p.event.name}</div>
                    </div>
                    <span className="text-lg font-black text-white">{formatCurrency(p.price)}</span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Stock remaining</span>
                      <span className={`font-bold ${isLow ? 'text-orange-400' : 'text-white'}`}>
                        {p.stock} {isLow && '⚠️'}
                      </span>
                    </div>
                    <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, (p.stock / (p.stock + p.sold)) * 100)}%`,
                          background: isLow ? '#F59E0B' : '#8B5CF6'
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>{p.sold} sold</span>
                      <span>{p.stock + p.sold} total</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
