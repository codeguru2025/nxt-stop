'use client'

import { useEffect, useState, useCallback } from 'react'
import AdminLayout from './AdminLayout'
import { Search, Ticket, Check, X, RefreshCw, AlertTriangle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'

type TicketRow = {
  id: string
  ticketNumber: string
  status: string
  createdAt: string
  event: { name: string; date: string; venue: string }
  ticketType: { name: string; color: string; price: number }
  user: { name: string; email: string }
  order: { orderNumber: string; paymentMethod: string | null; total: number; status: string; recipientName?: string; guestName?: string }
}

type OrderRow = {
  id: string
  orderNumber: string
  status: string
  total: number
  paymentMethod: string | null
  createdAt: string
  user: { name: string; email: string }
  items: { name: string; quantity: number; price: number }[]
  tickets: { id: string; ticketNumber: string; status: string }[]
  guestEmail?: string
  guestName?: string
}

const STATUS_COLOR: Record<string, string> = {
  valid:   'bg-green-500/20 text-green-400',
  used:    'bg-gray-500/20 text-gray-400',
  cancelled: 'bg-red-500/20 text-red-400',
  paid:    'bg-green-500/20 text-green-400',
  pending: 'bg-yellow-500/20 text-yellow-400',
  failed:  'bg-red-500/20 text-red-400',
}

export default function AdminTicketsClient() {
  const [tab, setTab] = useState<'tickets' | 'orders'>('tickets')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<{ id: string; msg: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams({ search, page: String(page), ...(statusFilter && { status: statusFilter }) })
    const url = tab === 'tickets' ? `/api/admin/tickets?${qs}` : `/api/admin/orders?${qs}`
    const res = await fetch(url).then(r => r.json()).catch(() => null)
    if (res?.success) {
      if (tab === 'tickets') {
        setTickets(res.data.tickets)
        setTotal(res.data.total)
        setPages(res.data.pages)
      } else {
        setOrders(res.data.orders)
        setTotal(res.data.total)
        setPages(res.data.pages)
      }
    }
    setLoading(false)
  }, [tab, search, page, statusFilter])

  useEffect(() => { load() }, [load])

  const orderAction = async (orderId: string, action: 'fulfill' | 'check' | 'cancel') => {
    setActionLoading(orderId)
    const res = await fetch('/api/admin/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, action }),
    }).then(r => r.json())
    setActionLoading(null)
    setActionMsg({ id: orderId, msg: res.data?.message ?? res.error ?? 'Done' })
    setTimeout(() => setActionMsg(null), 4000)
    load()
  }

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-white">Tickets & Orders</h1>
            <p className="text-gray-500 text-sm mt-0.5">{total} records</p>
          </div>
          <button onClick={load} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-[#111] rounded-xl p-1 w-fit">
          {(['tickets', 'orders'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setPage(1) }}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${tab === t ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-white'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder={tab === 'tickets' ? 'Search name, email, ticket #...' : 'Search name, email, order #...'}
              className="pl-8 py-2 text-sm"
            />
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className="text-sm py-2 px-3">
            <option value="">All statuses</option>
            {tab === 'tickets'
              ? ['valid', 'used', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)
              : ['pending', 'paid', 'failed'].map(s => <option key={s} value={s}>{s}</option>)
            }
          </select>
        </div>

        {loading ? (
          <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
        ) : tab === 'tickets' ? (
          <>
            <div className="space-y-2">
              {tickets.length === 0 && <p className="text-gray-500 text-center py-12">No tickets found.</p>}
              {tickets.map(t => (
                <div key={t.id} className="card p-4 flex items-center gap-4">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.ticketType.color }} />
                  <div className="flex-1 min-w-0 grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-white font-semibold truncate">{t.order?.recipientName || t.order?.guestName || t.user.name}</p>
                      <p className="text-gray-500 text-xs truncate">{t.user.email}</p>
                    </div>
                    <div>
                      <p className="text-white font-mono text-xs">{t.ticketNumber}</p>
                      <p className="text-gray-500 text-xs">{t.ticketType.name} · {formatCurrency(t.ticketType.price)}</p>
                    </div>
                    <div>
                      <p className="text-gray-300 text-xs truncate">{t.event.name}</p>
                      <p className="text-gray-500 text-xs">{formatDate(t.event.date, 'MMM d, yyyy')}</p>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[t.status] ?? ''}`}>{t.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              {orders.length === 0 && <p className="text-gray-500 text-center py-12">No orders found.</p>}
              {orders.map(o => (
                <div key={o.id} className="card p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0 grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-white font-semibold truncate">{o.guestName || o.user.name}</p>
                        <p className="text-gray-500 text-xs truncate">{o.guestEmail || o.user.email}</p>
                      </div>
                      <div>
                        <p className="text-white font-mono text-xs">{o.orderNumber}</p>
                        <p className="text-gray-500 text-xs">{o.paymentMethod ?? '—'} · {formatCurrency(o.total)}</p>
                      </div>
                      <div>
                        <p className="text-gray-300 text-xs">{o.items.map(i => i.name).join(', ')}</p>
                        <p className="text-gray-500 text-xs">{formatDate(o.createdAt, 'MMM d, h:mm a')}</p>
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[o.status] ?? ''}`}>{o.status}</span>
                      </div>
                    </div>
                  </div>

                  {/* Tickets generated */}
                  {o.tickets.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1 pl-0">
                      {o.tickets.map(t => (
                        <span key={t.id} className="text-xs font-mono bg-[#111] border border-[#2a2a2a] px-2 py-0.5 rounded">
                          {t.ticketNumber} <span className="text-gray-600">· {t.status}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Admin actions */}
                  {o.status !== 'paid' && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => orderAction(o.id, 'check')}
                        disabled={!!actionLoading}
                        className="flex items-center gap-1 text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 rounded-lg px-3 py-1.5 transition-colors"
                      >
                        {actionLoading === o.id ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                        Re-check Paynow
                      </button>
                      {o.status === 'pending' && (
                        <button
                          onClick={() => orderAction(o.id, 'fulfill')}
                          disabled={!!actionLoading}
                          className="flex items-center gap-1 text-xs bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 rounded-lg px-3 py-1.5 transition-colors"
                        >
                          <Check size={11} /> Manually Fulfill
                        </button>
                      )}
                      <button
                        onClick={() => orderAction(o.id, 'cancel')}
                        disabled={!!actionLoading}
                        className="flex items-center gap-1 text-xs bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-lg px-3 py-1.5 transition-colors"
                      >
                        <X size={11} /> Cancel
                      </button>
                    </div>
                  )}

                  {actionMsg?.id === o.id && (
                    <p className="mt-2 text-xs text-purple-400">{actionMsg.msg}</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 disabled:opacity-40">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-gray-400">Page {page} of {pages}</span>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="p-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 disabled:opacity-40">
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
