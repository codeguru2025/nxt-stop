'use client'

import { useEffect, useState, useCallback } from 'react'
import AdminLayout from './AdminLayout'
import { Search, Ticket, Check, X, RefreshCw, AlertTriangle, Loader2, ChevronLeft, ChevronRight, Printer, Download } from 'lucide-react'
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

type EventOption = {
  id: string
  name: string
  date: string
  venue: string
  ticketTypes: { id: string; name: string; color: string; price: number }[]
}

type GeneratedBatch = {
  event: { name: string; date: string; venue: string }
  ticketType: { name: string; color: string; price: number }
  tickets: { ticketNumber: string; qrCode: string; qrDataUrl: string; activationCode: string }[]
}

const STATUS_COLOR_EXTRA: Record<string, string> = {
  physical: 'bg-orange-500/20 text-orange-400',
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
  const [tab, setTab] = useState<'tickets' | 'orders' | 'hardcopy'>('tickets')
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

  // Hard copy state
  const [events, setEvents] = useState<EventOption[]>([])
  const [hcEventId, setHcEventId] = useState('')
  const [hcTicketTypeId, setHcTicketTypeId] = useState('')
  const [hcQty, setHcQty] = useState(1)
  const [hcGenerating, setHcGenerating] = useState(false)
  const [hcBatch, setHcBatch] = useState<GeneratedBatch | null>(null)

  const load = useCallback(async () => {
    if (tab === 'hardcopy') return
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

  // Load events for hard copy tab
  useEffect(() => {
    if (tab === 'hardcopy' && events.length === 0) {
      fetch('/api/admin/events').then(r => r.json()).then(d => {
        if (d.success) setEvents(d.data)
      })
    }
  }, [tab, events.length])

  const selectedEvent = events.find(e => e.id === hcEventId)
  const selectedTicketType = selectedEvent?.ticketTypes.find(t => t.id === hcTicketTypeId)

  const generateHardCopy = async () => {
    if (!hcEventId || !hcTicketTypeId || hcQty < 1) return
    setHcGenerating(true)
    setHcBatch(null)
    const res = await fetch('/api/admin/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: hcEventId, ticketTypeId: hcTicketTypeId, quantity: hcQty }),
    }).then(r => r.json())
    setHcGenerating(false)
    if (res.success) setHcBatch(res.data)
  }

  const printBatch = () => {
    if (!hcBatch) return
    const printWin = window.open('', '_blank', 'width=900,height=700')
    if (!printWin) return

    const dateStr = new Date(hcBatch.event.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

    const ticketHtml = hcBatch.tickets.map(t => `
      <div class="ticket">
        <!-- BUYER HALF -->
        <div class="ticket-header">
          <div class="badge" style="background:${hcBatch.ticketType.color}">${hcBatch.ticketType.name}</div>
          <div class="event">${hcBatch.event.name}</div>
          <div class="meta">${dateStr} · ${hcBatch.event.venue}</div>
        </div>
        <div class="ticket-body">
          <img src="${t.qrDataUrl}" class="qr" />
          <div class="info">
            <div class="label">Ticket No.</div>
            <div class="number">${t.ticketNumber}</div>
            <div class="label">Price</div>
            <div class="price">$${hcBatch.ticketType.price.toFixed(2)}</div>
            <div class="label">Payment</div>
            <div class="cash">CASH</div>
          </div>
        </div>
        <div class="ticket-footer">NXT STOP · Present QR code at the gate · nxtstop.com</div>
        <!-- SELLER STUB (tear off) -->
        <div class="stub">
          <div class="stub-row">
            <div>
              <div class="stub-label">ACTIVATION CODE</div>
              <div class="stub-code">${t.activationCode}</div>
            </div>
            <div class="stub-right">
              <div class="stub-label">Ticket</div>
              <div class="stub-num">${t.ticketNumber}</div>
              <div class="stub-label" style="margin-top:4px">Price</div>
              <div class="stub-price">$${hcBatch.ticketType.price.toFixed(2)}</div>
            </div>
          </div>
          <div class="stub-note">SELLER STUB — tear off &amp; keep when ticket is sold. Enter code at /gate/activate to record sale.</div>
        </div>
      </div>
    `).join('')

    printWin.document.write(`<!DOCTYPE html><html><head><title>NXT STOP Hard Copy Tickets</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;font-family:-apple-system,sans-serif}
      body{background:#f5f5f5;padding:16px}
      h1{font-size:18px;font-weight:900;color:#111;margin-bottom:4px}
      .subtitle{font-size:12px;color:#6b7280;margin-bottom:16px}
      .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
      .ticket{background:#fff;border:1.5px solid #e5e7eb;border-radius:12px;overflow:hidden;break-inside:avoid}
      .ticket-header{padding:12px 14px 10px;border-bottom:2px dashed #e5e7eb}
      .badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700;color:#fff;margin-bottom:4px}
      .event{font-size:13px;font-weight:900;color:#111}
      .meta{font-size:10px;color:#6b7280;margin-top:2px}
      .ticket-body{padding:10px 14px;display:flex;gap:12px;align-items:center}
      .qr{width:80px;height:80px;border:1px solid #e5e7eb;padding:2px;border-radius:6px}
      .info{flex:1}
      .label{font-size:8px;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;margin-top:6px}
      .label:first-child{margin-top:0}
      .number{font-size:11px;font-family:monospace;color:#374151;font-weight:700}
      .price{font-size:16px;font-weight:900;color:#7c3aed}
      .cash{font-size:9px;color:#6b7280}
      .ticket-footer{background:#f9fafb;padding:6px 14px;font-size:9px;color:#9ca3af;border-top:1px solid #f3f4f6}
      .label{font-size:8px;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;margin-top:6px}
      .label:first-child{margin-top:0}
      .number{font-size:11px;font-family:monospace;color:#374151;font-weight:700}
      .price{font-size:16px;font-weight:900;color:#7c3aed}
      .cash{font-size:9px;color:#6b7280}
      .ticket-footer{background:#f9fafb;padding:6px 14px;font-size:9px;color:#9ca3af;border-top:1px solid #f3f4f6}
      .stub{background:#fff7ed;border-top:2px dashed #f97316;padding:8px 14px}
      .stub-row{display:flex;justify-content:space-between;align-items:flex-start}
      .stub-label{font-size:7px;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;margin-bottom:1px}
      .stub-code{font-size:22px;font-weight:900;font-family:monospace;color:#ea580c;letter-spacing:3px}
      .stub-right{text-align:right}
      .stub-num{font-size:9px;font-family:monospace;color:#374151;font-weight:700}
      .stub-price{font-size:13px;font-weight:900;color:#7c3aed}
      .stub-note{font-size:7px;color:#9ca3af;margin-top:4px;border-top:1px solid #fed7aa;padding-top:4px}
      @media print{body{background:#fff;padding:0}@page{margin:10mm}}
    </style></head><body>
    <h1>NXT STOP Physical Tickets — ${hcBatch.event.name}</h1>
    <p class="subtitle">${hcBatch.tickets.length} tickets · Printed ${new Date().toLocaleString()} · NOT YET SOLD — activate each ticket when cash is collected</p>
    <div class="grid">${ticketHtml}</div>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1000)}</script>
    </body></html>`)
    printWin.document.close()
  }

  const downloadAllQRs = async () => {
    if (!hcBatch) return
    // Download individual QR images as a zip-like approach: download each
    for (const t of hcBatch.tickets) {
      const a = document.createElement('a')
      a.href = t.qrDataUrl
      a.download = `${t.ticketNumber}.png`
      a.click()
      await new Promise(r => setTimeout(r, 100))
    }
  }

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
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-white">Tickets & Orders</h1>
            <p className="text-gray-500 text-sm mt-0.5">{tab !== 'hardcopy' ? `${total} records` : 'Generate physical tickets'}</p>
          </div>
          {tab !== 'hardcopy' && (
            <button onClick={load} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-[#111] rounded-xl p-1 w-fit">
          {(['tickets', 'orders', 'hardcopy'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setPage(1) }}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${tab === t ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-white'}`}
            >
              {t === 'hardcopy' ? 'Hard Copy' : t}
            </button>
          ))}
        </div>

        {/* ── HARD COPY TAB ── */}
        {tab === 'hardcopy' && (
          <div className="space-y-6">
            <div className="card p-5">
              <h3 className="font-bold text-white mb-1">Generate Physical Tickets</h3>
              <p className="text-gray-500 text-sm mb-5">Create cash-sale tickets with QR codes to print and sell at the door.</p>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label>Event *</label>
                  <select value={hcEventId} onChange={e => { setHcEventId(e.target.value); setHcTicketTypeId('') }}>
                    <option value="">Select event…</option>
                    {events.map(ev => (
                      <option key={ev.id} value={ev.id}>{ev.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Ticket Type *</label>
                  <select value={hcTicketTypeId} onChange={e => setHcTicketTypeId(e.target.value)} disabled={!hcEventId}>
                    <option value="">Select type…</option>
                    {selectedEvent?.ticketTypes.map(tt => (
                      <option key={tt.id} value={tt.id}>{tt.name} — {formatCurrency(tt.price)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Quantity *</label>
                  <input type="number" min={1} max={200} value={hcQty} onChange={e => setHcQty(parseInt(e.target.value) || 1)} />
                </div>
              </div>
              {selectedTicketType && (
                <div className="mt-4 p-3 bg-[#111] rounded-xl text-sm text-gray-400 flex gap-6">
                  <span>Total cash value: <span className="text-white font-bold">{formatCurrency(selectedTicketType.price * hcQty)}</span></span>
                  <span>Tickets: <span className="text-white font-bold">{hcQty}</span></span>
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-5">
                <button
                  onClick={generateHardCopy}
                  disabled={!hcEventId || !hcTicketTypeId || hcQty < 1 || hcGenerating}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  {hcGenerating ? <Loader2 size={14} className="animate-spin" /> : <Ticket size={14} />}
                  {hcGenerating ? 'Generating…' : 'Generate Tickets'}
                </button>
                {hcBatch && (
                  <>
                    <button onClick={printBatch} className="flex items-center gap-2 text-sm bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 rounded-lg px-4 py-2">
                      <Printer size={14} /> Print All
                    </button>
                    <button onClick={downloadAllQRs} className="flex items-center gap-2 text-sm bg-[#1a1a1a] border border-[#2a2a2a] text-gray-300 hover:text-white rounded-lg px-4 py-2">
                      <Download size={14} /> Download QRs
                    </button>
                    <a href="/gate/activate" target="_blank" className="flex items-center gap-2 text-sm bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 rounded-lg px-4 py-2 transition-colors">
                      <AlertTriangle size={14} /> Activate Page
                    </a>
                  </>
                )}
              </div>
            </div>

            {/* Generated ticket preview */}
            {hcBatch && (
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-white">{hcBatch.tickets.length} Tickets Generated</h3>
                    <p className="text-gray-500 text-sm">Inventory · {hcBatch.event.name}</p>
                  </div>
                </div>
                <p className="text-xs text-orange-400/80 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2 mb-2">
                  These tickets are <strong>NOT yet sold</strong>. They will only count as sales once activated using the code on the stub.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {hcBatch.tickets.map(t => (
                    <div key={t.ticketNumber} className="bg-[#111] border border-[#2a2a2a] rounded-xl p-3 flex flex-col items-center gap-2">
                      <img src={t.qrDataUrl} alt={t.ticketNumber} className="w-20 h-20 rounded-lg bg-white p-1" />
                      <span className="text-xs font-mono text-gray-400 text-center break-all">{t.ticketNumber}</span>
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-xs text-gray-600 uppercase tracking-widest">Activation</span>
                        <span className="text-base font-black font-mono text-orange-400 tracking-widest">{t.activationCode}</span>
                      </div>
                      <span className="text-xs font-bold text-purple-400">{formatCurrency(hcBatch.ticketType.price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TICKETS / ORDERS TABS ── */}
        {tab !== 'hardcopy' && (
          <>
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

                      {o.tickets.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1 pl-0">
                          {o.tickets.map(t => (
                            <span key={t.id} className="text-xs font-mono bg-[#111] border border-[#2a2a2a] px-2 py-0.5 rounded">
                              {t.ticketNumber} <span className="text-gray-600">· {t.status}</span>
                            </span>
                          ))}
                        </div>
                      )}

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
          </>
        )}
      </div>
    </AdminLayout>
  )
}
