'use client'

import { useEffect, useState, useCallback } from 'react'
import AdminLayout from './AdminLayout'
import {
  Plus, AlertTriangle, Package, ShoppingBag, Loader2,
  Check, X, RefreshCw, Pencil, Trash2, ChevronDown,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

type Product = {
  id: string
  name: string
  price: number
  stock: number
  sold: number
  category: string
  merchType?: string | null
  size?: string | null
  color?: string | null
  active: boolean
  lowStockAt: number
  description?: string | null
  image?: string | null
  event: { name: string }
}

type Event = { id: string; name: string }

const DRINK_CATEGORIES = ['drink', 'food', 'other']

const MERCH_TYPES = [
  { value: 'tshirt',    label: 'T-Shirt' },
  { value: 'hoodie',    label: 'Hoodie' },
  { value: 'cap',       label: 'Cap' },
  { value: 'wineglass', label: 'Wine Glass' },
  { value: 'tote',      label: 'Tote Bag' },
  { value: 'vinyl',     label: 'Vinyl / CD' },
  { value: 'poster',    label: 'Poster' },
  { value: 'wristband', label: 'Wristband' },
  { value: 'other',     label: 'Other' },
]

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size']

const BLANK_PRODUCT = {
  eventId: '', name: '', description: '', price: 0, stock: 50,
  category: 'drink', lowStockAt: 10, image: '',
  merchType: '', size: '', color: '',
}

const BLANK_MERCH = {
  eventId: '', price: 0, stock: 50, lowStockAt: 5, image: '',
  description: '', color: '', size: 'One Size', merchType: 'tshirt',
}

function stockBar(stock: number, sold: number, lowAt: number) {
  const total = stock + sold
  const pct = total === 0 ? 0 : Math.min(100, (stock / total) * 100)
  const isLow = stock <= lowAt
  return { pct, isLow }
}

export default function AdminStoreClient() {
  const [tab, setTab] = useState<'drinks' | 'merch'>('merch')
  const [products, setProducts] = useState<Product[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [drinkForm, setDrinkForm] = useState({ ...BLANK_PRODUCT })
  const [merchForm, setMerchForm] = useState({ ...BLANK_MERCH })
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [stockEdit, setStockEdit] = useState<{ id: string; stock: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [prodRes, evRes] = await Promise.all([
      fetch('/api/admin/products').then(r => r.json()),
      fetch('/api/admin/events').then(r => r.json()),
    ])
    if (prodRes.success) setProducts(prodRes.data)
    if (evRes.success) setEvents(evRes.data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const displayed = products.filter(p =>
    tab === 'merch' ? p.category === 'merchandise' : p.category !== 'merchandise'
  )
  const lowStock = displayed.filter(p => p.stock <= p.lowStockAt && p.active)

  const saveDrink = async () => {
    setSaving(true)
    const body = { ...drinkForm, category: drinkForm.category === 'merchandise' ? 'drink' : drinkForm.category }
    const res = await fetch('/api/admin/products', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then(r => r.json())
    setSaving(false)
    if (res.success) { load(); setShowForm(false); setDrinkForm({ ...BLANK_PRODUCT }) }
  }

  const saveMerch = async () => {
    setSaving(true)
    const label = MERCH_TYPES.find(t => t.value === merchForm.merchType)?.label ?? 'Merchandise'
    const name = `${label}${merchForm.size && merchForm.size !== 'One Size' ? ` (${merchForm.size})` : ''}${merchForm.color ? ` - ${merchForm.color}` : ''}`
    const body = {
      ...merchForm,
      name,
      category: 'merchandise',
    }
    const res = await fetch('/api/admin/products', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then(r => r.json())
    setSaving(false)
    if (res.success) { load(); setShowForm(false); setMerchForm({ ...BLANK_MERCH }) }
  }

  const updateStock = async (id: string, newStock: number) => {
    setActionLoading(id)
    await fetch(`/api/admin/products/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock: newStock }),
    })
    setActionLoading(null)
    setStockEdit(null)
    load()
  }

  const recordSale = async (id: string, product: Product) => {
    if (product.stock <= 0) return
    setActionLoading(id)
    await fetch(`/api/admin/products/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock: product.stock - 1, sold: product.sold + 1 }),
    })
    setActionLoading(null)
    load()
  }

  const deactivate = async (id: string) => {
    setActionLoading(id)
    await fetch(`/api/admin/products/${id}`, { method: 'DELETE' })
    setActionLoading(null)
    load()
  }

  return (
    <AdminLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-white">Event Store</h1>
            <p className="text-gray-500 text-sm mt-0.5">{displayed.length} items · {displayed.reduce((s, p) => s + p.sold, 0)} sold</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 text-gray-400 hover:text-white transition-colors">
              <RefreshCw size={16} />
            </button>
            <button onClick={() => { setShowForm(true); setEditing(null) }} className="flex items-center gap-2 btn-primary text-sm">
              <Plus size={16} /> Add {tab === 'merch' ? 'Merch' : 'Product'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-[#111] rounded-xl p-1 w-fit">
          {([['merch', 'Merchandise', ShoppingBag], ['drinks', 'Drinks & Food', Package]] as const).map(([t, label, Icon]) => (
            <button
              key={t}
              onClick={() => { setTab(t); setShowForm(false) }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-white'}`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* Low stock alerts */}
        {lowStock.length > 0 && (
          <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} className="text-orange-400" />
              <span className="font-semibold text-orange-300 text-sm">{lowStock.length} running low</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {lowStock.map(p => (
                <span key={p.id} className="bg-orange-500/10 border border-orange-500/20 rounded-lg px-2.5 py-1 text-xs">
                  <span className="text-white font-medium">{p.name}</span>
                  <span className="text-orange-400 ml-1.5">{p.stock} left</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── MERCH FORM ─────────────────────────────────── */}
        {showForm && tab === 'merch' && (
          <div className="card p-5 mb-6">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <ShoppingBag size={16} className="text-purple-400" /> Add Merchandise
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="sm:col-span-2 lg:col-span-3">
                <label>Event *</label>
                <select value={merchForm.eventId} onChange={e => setMerchForm(f => ({ ...f, eventId: e.target.value }))}>
                  <option value="">Select event...</option>
                  {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                </select>
              </div>

              <div>
                <label>Merch Type *</label>
                <select value={merchForm.merchType} onChange={e => setMerchForm(f => ({ ...f, merchType: e.target.value }))}>
                  {MERCH_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              <div>
                <label>Size</label>
                <select value={merchForm.size} onChange={e => setMerchForm(f => ({ ...f, size: e.target.value }))}>
                  {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label>Colour / Design</label>
                <input value={merchForm.color} onChange={e => setMerchForm(f => ({ ...f, color: e.target.value }))} placeholder="e.g. Black, White, Navy" />
              </div>

              <div>
                <label>Price (USD) *</label>
                <input type="number" step="0.01" min="0" value={merchForm.price}
                  onChange={e => setMerchForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
              </div>

              <div>
                <label>Initial Stock *</label>
                <input type="number" min="0" value={merchForm.stock}
                  onChange={e => setMerchForm(f => ({ ...f, stock: parseInt(e.target.value) || 0 }))} />
              </div>

              <div>
                <label>Low Stock Alert At</label>
                <input type="number" min="0" value={merchForm.lowStockAt}
                  onChange={e => setMerchForm(f => ({ ...f, lowStockAt: parseInt(e.target.value) || 0 }))} />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label>Description / Notes</label>
                <input value={merchForm.description} onChange={e => setMerchForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional details" />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label>Image URL</label>
                <input value={merchForm.image} onChange={e => setMerchForm(f => ({ ...f, image: e.target.value }))} placeholder="https://..." />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={saveMerch}
                disabled={saving || !merchForm.eventId || !merchForm.price}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Add Merch
              </button>
              <button onClick={() => setShowForm(false)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-white border border-[#2a2a2a] rounded-lg px-3 py-2 transition-colors">
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── DRINK/FOOD FORM ─────────────────────────────── */}
        {showForm && tab === 'drinks' && (
          <div className="card p-5 mb-6">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <Package size={16} className="text-purple-400" /> Add Product
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label>Event *</label>
                <select value={drinkForm.eventId} onChange={e => setDrinkForm(f => ({ ...f, eventId: e.target.value }))}>
                  <option value="">Select event...</option>
                  {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                </select>
              </div>
              <div><label>Name *</label><input value={drinkForm.name} onChange={e => setDrinkForm(f => ({ ...f, name: e.target.value }))} placeholder="Heineken" /></div>
              <div>
                <label>Category</label>
                <select value={drinkForm.category} onChange={e => setDrinkForm(f => ({ ...f, category: e.target.value }))}>
                  {DRINK_CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                </select>
              </div>
              <div><label>Price ($)</label><input type="number" step="0.01" value={drinkForm.price} onChange={e => setDrinkForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} /></div>
              <div><label>Initial Stock</label><input type="number" value={drinkForm.stock} onChange={e => setDrinkForm(f => ({ ...f, stock: parseInt(e.target.value) || 0 }))} /></div>
              <div><label>Low Stock Alert At</label><input type="number" value={drinkForm.lowStockAt} onChange={e => setDrinkForm(f => ({ ...f, lowStockAt: parseInt(e.target.value) || 0 }))} /></div>
              <div className="sm:col-span-2"><label>Description</label><input value={drinkForm.description} onChange={e => setDrinkForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={saveDrink} disabled={saving || !drinkForm.eventId || !drinkForm.name} className="btn-primary flex items-center gap-2 text-sm">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Add Product
              </button>
              <button onClick={() => setShowForm(false)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-white border border-[#2a2a2a] rounded-lg px-3 py-2 transition-colors">
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── PRODUCT LIST ────────────────────────────────── */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-40 rounded-xl" />)}
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">{tab === 'merch' ? '👕' : '🥤'}</div>
            <p className="text-gray-500 mb-2">{tab === 'merch' ? 'No merchandise yet.' : 'No products yet.'}</p>
            <button onClick={() => setShowForm(true)} className="text-sm text-purple-400 hover:text-purple-300 underline">
              Add the first {tab === 'merch' ? 'merch item' : 'product'}
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayed.map(p => {
              const { pct, isLow } = stockBar(p.stock, p.sold, p.lowStockAt)
              const merchLabel = MERCH_TYPES.find(t => t.value === p.merchType)?.label
              return (
                <div key={p.id} className={`card p-4 flex flex-col gap-3 transition-all ${!p.active ? 'opacity-40' : ''}`}>
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm truncate">{p.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {tab === 'merch' ? (
                          <>{merchLabel ?? p.category}{p.size ? ` · ${p.size}` : ''}{p.color ? ` · ${p.color}` : ''}</>
                        ) : (
                          <span className="capitalize">{p.category}</span>
                        )}
                        {' · '}{p.event.name}
                      </p>
                    </div>
                    <span className="text-white font-black text-sm shrink-0 ml-2">{formatCurrency(p.price)}</span>
                  </div>

                  {/* Stock bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Stock</span>
                      <span className={`font-bold ${isLow ? 'text-orange-400' : 'text-white'}`}>
                        {p.stock} left{isLow && ' ⚠️'}
                      </span>
                    </div>
                    <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: isLow ? '#F59E0B' : '#8B5CF6' }} />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>{p.sold} sold</span>
                      <span>{p.stock + p.sold} total</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5 flex-wrap">
                    {/* Record sale */}
                    <button
                      onClick={() => recordSale(p.id, p)}
                      disabled={!!actionLoading || p.stock === 0}
                      className="flex-1 flex items-center justify-center gap-1 text-xs bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 rounded-lg px-2 py-1.5 transition-colors disabled:opacity-40"
                    >
                      {actionLoading === p.id ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                      Sold 1
                    </button>

                    {/* Edit stock */}
                    {stockEdit?.id === p.id ? (
                      <div className="flex gap-1">
                        <input
                          type="number"
                          className="w-16 text-xs py-1 px-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-white"
                          value={stockEdit.stock}
                          onChange={e => setStockEdit(s => s ? { ...s, stock: e.target.value } : null)}
                        />
                        <button
                          onClick={() => updateStock(p.id, parseInt(stockEdit.stock) || 0)}
                          disabled={!!actionLoading}
                          className="text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg px-2 py-1.5 hover:bg-blue-500/20 transition-colors"
                        >
                          {actionLoading === p.id ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                        </button>
                        <button onClick={() => setStockEdit(null)} className="text-xs text-gray-500 hover:text-white px-1">
                          <X size={10} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setStockEdit({ id: p.id, stock: String(p.stock) })}
                        className="flex items-center gap-1 text-xs bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 hover:text-white rounded-lg px-2 py-1.5 transition-colors"
                      >
                        <Pencil size={10} /> Stock
                      </button>
                    )}

                    {/* Deactivate */}
                    {p.active && (
                      <button
                        onClick={() => deactivate(p.id)}
                        disabled={!!actionLoading}
                        className="flex items-center gap-1 text-xs bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-lg px-2 py-1.5 transition-colors"
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
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
