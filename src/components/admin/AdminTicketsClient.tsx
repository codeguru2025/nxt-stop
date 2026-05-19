'use client'

import { useEffect, useState, useCallback } from 'react'
import AdminLayout from './AdminLayout'
import { Search, Ticket, Check, X, RefreshCw, AlertTriangle, Loader2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Printer, Calendar, MapPin, QrCode } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'

const LOGO_URL = 'https://nxtstop-uploads.lon1.cdn.digitaloceanspaces.com/nxt-stop%20logo%20new.png'

function money(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  if (typeof v === 'string') return parseFloat(v) || 0
  if (typeof v === 'object' && v !== null && 'toNumber' in v && typeof (v as { toNumber: () => number }).toNumber === 'function') {
    return (v as { toNumber: () => number }).toNumber()
  }
  return Number(v) || 0
}

async function fetchAsDataURL(url: string): Promise<string> {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
  } catch {
    return url
  }
}

type TicketRow = {
  id: string
  ticketNumber: string
  status: string
  createdAt: string
  event: { name: string; date: string; venue: string }
  ticketType: { name: string; color: string; price: number }
  user: { name: string; phone: string }
  order: { orderNumber: string; paymentMethod: string | null; total: number; status: string; recipientName?: string; guestName?: string }
}

type OrderRow = {
  id: string
  orderNumber: string
  status: string
  total: number
  paymentMethod: string | null
  createdAt: string
  user: { name: string; phone: string }
  items: { name: string; quantity: number; price: number }[]
  tickets: { id: string; ticketNumber: string; status: string }[]
  guestPhone?: string
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
  event: { name: string; date: string; venue: string; posterImage?: string | null }
  ticketType: { name: string; color: string; price: number }
  tickets: { ticketNumber: string; qrCode: string; qrDataUrl: string; activationCode: string }[]
}

type BatchSummary = {
  eventId: string
  ticketTypeId: string
  event: { id: string; name: string; date: string; venue: string; posterImage?: string | null } | null
  ticketType: { id: string; name: string; color: string; price: number } | null
  unsold: number
  activated: number
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
  const [hcLoadingExisting, setHcLoadingExisting] = useState(false)
  const [hcExistingCount, setHcExistingCount] = useState<number | null>(null)

  // Batch overview state
  const [batches, setBatches] = useState<BatchSummary[]>([])
  const [batchesLoading, setBatchesLoading] = useState(false)
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null)
  const [expandedTickets, setExpandedTickets] = useState<any[]>([])
  const [expandedLoading, setExpandedLoading] = useState(false)

  const [adminTicketId, setAdminTicketId] = useState<string | null>(null)
  const [adminTicketData, setAdminTicketData] = useState<any>(null)
  const [adminTicketLoading, setAdminTicketLoading] = useState(false)

  const [orderDetailId, setOrderDetailId] = useState<string | null>(null)
  const [orderDetailData, setOrderDetailData] = useState<any>(null)
  const [orderDetailLoading, setOrderDetailLoading] = useState(false)

  const [physicalPreview, setPhysicalPreview] = useState<{
    event: GeneratedBatch['event'] & { posterImage?: string | null }
    ticketType: GeneratedBatch['ticketType']
    ticket: { ticketNumber: string; qrDataUrl: string; activationCode: string }
  } | null>(null)

  useEffect(() => {
    if (!adminTicketId) {
      setAdminTicketData(null)
      return
    }
    setAdminTicketLoading(true)
    fetch(`/api/admin/tickets/${adminTicketId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setAdminTicketData(d.data) })
      .finally(() => setAdminTicketLoading(false))
  }, [adminTicketId])

  useEffect(() => {
    if (!orderDetailId) {
      setOrderDetailData(null)
      return
    }
    setOrderDetailLoading(true)
    fetch(`/api/admin/orders/${orderDetailId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setOrderDetailData(d.data) })
      .finally(() => setOrderDetailLoading(false))
  }, [orderDetailId])

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

  useEffect(() => {
    if (tab === 'hardcopy') {
      if (events.length === 0) {
        fetch('/api/admin/events').then(r => r.json()).then(d => {
          if (d.success) setEvents(d.data)
        })
      }
      loadBatches()
    }
  }, [tab])

  const selectedEvent = events.find(e => e.id === hcEventId)
  const selectedTicketType = selectedEvent?.ticketTypes.find(t => t.id === hcTicketTypeId)

  const loadBatches = async () => {
    setBatchesLoading(true)
    const res = await fetch('/api/admin/tickets?groupBy=batch').then(r => r.json()).catch(() => null)
    if (res?.success) setBatches(res.data)
    setBatchesLoading(false)
  }

  const expandBatch = async (eventId: string, ticketTypeId: string) => {
    const key = `${eventId}:${ticketTypeId}`
    if (expandedBatch === key) { setExpandedBatch(null); return }
    setExpandedBatch(key)
    setExpandedLoading(true)
    const res = await fetch(`/api/admin/tickets?status=physical&eventId=${eventId}&ticketTypeId=${ticketTypeId}&includeQR=true`).then(r => r.json()).catch(() => null)
    if (res?.success) setExpandedTickets(res.data.tickets ?? [])
    setExpandedLoading(false)
  }

  // Check how many unsold physical tickets already exist for the selected event
  const checkExisting = async (eventId: string, ticketTypeId: string) => {
    if (!eventId || !ticketTypeId) { setHcExistingCount(null); return }
    const res = await fetch(`/api/admin/tickets?status=physical&eventId=${eventId}`).then(r => r.json())
    if (res.success) setHcExistingCount(res.data.total ?? 0)
  }

  const loadExistingBatch = async () => {
    if (!hcEventId || !hcTicketTypeId) return
    setHcLoadingExisting(true)
    setHcBatch(null)
    const res = await fetch(`/api/admin/tickets?status=physical&eventId=${hcEventId}&includeQR=true`).then(r => r.json())
    setHcLoadingExisting(false)
    if (res.success && res.data.tickets?.length > 0) {
      setHcBatch({
        event: res.data.event,
        ticketType: res.data.ticketType,
        tickets: res.data.tickets,
      })
    }
  }

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
    if (res.success) { setHcBatch(res.data); loadBatches() }
  }

  const printBatch = async () => {
    if (!hcBatch) return
    const printWin = window.open('', '_blank', 'width=1000,height=800')
    if (!printWin) return

    const logoDataUrl = await fetchAsDataURL(LOGO_URL)
    const d = new Date(hcBatch.event.date)
    const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    const priceStr = `$${money(hcBatch.ticketType.price).toFixed(2)}`

    const ticketHtml = hcBatch.tickets.map(t => `
      <div class="ticket">
        <div class="t-head">
          <img src="${logoDataUrl}" class="t-logo" />
          <div class="t-head-text">
            <div class="t-brand">NXT STOP</div>
            <div class="t-event">${hcBatch.event.name}</div>
          </div>
          <div class="t-badge" style="background:${hcBatch.ticketType.color}">${hcBatch.ticketType.name}</div>
        </div>
        <div class="t-body">
          <div class="t-details">
            <div class="t-row"><span class="t-icon">&#128197;</span><span>${dateStr}</span></div>
            <div class="t-row"><span class="t-icon">&#128336;</span><span>${timeStr}</span></div>
            <div class="t-row"><span class="t-icon">&#128205;</span><span>${hcBatch.event.venue}</span></div>
            <div class="t-price">${priceStr}</div>
            <div class="t-num">${t.ticketNumber}</div>
          </div>
          <div class="t-qr-wrap">
            <img src="${t.qrDataUrl}" class="t-qr" />
            <div class="t-cash">CASH</div>
          </div>
        </div>
        <div class="t-foot">NXT STOP &nbsp;·&nbsp; nxtstop.com &nbsp;·&nbsp; Present QR code at the gate</div>
        <div class="stub">
          <div class="stub-row">
            <div>
              <div class="stub-lbl">Activation Code</div>
              <div class="stub-code">${t.activationCode}</div>
            </div>
            <div class="stub-right">
              <div class="stub-lbl">Ticket No.</div>
              <div class="stub-num">${t.ticketNumber}</div>
              <div class="stub-lbl" style="margin-top:1.5mm">Price</div>
              <div class="stub-price">${priceStr}</div>
            </div>
          </div>
          <div class="stub-note">&#9988; SELLER STUB &mdash; tear off &amp; keep when sold &nbsp;&middot;&nbsp; Enter code at /gate/activate to record cash sale</div>
        </div>
      </div>
    `).join('')

    printWin.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>NXT STOP &mdash; ${hcBatch.event.name}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  @page{size:A4 portrait;margin:8mm}
  body{
    font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;
    background:#fff;
    -webkit-print-color-adjust:exact;
    print-color-adjust:exact;
    color-adjust:exact;
  }
  .page-hd{
    display:flex;justify-content:space-between;align-items:flex-end;
    padding-bottom:3mm;margin-bottom:4mm;
    border-bottom:.4mm solid #e5e7eb;
  }
  .page-title{font-size:10pt;font-weight:900;color:#111}
  .page-sub{font-size:7pt;color:#6b7280;margin-top:.5mm}
  .page-meta{font-size:6.5pt;color:#9ca3af;text-align:right;line-height:1.5}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:4mm}
  .ticket{
    border:.4mm solid #d1d5db;border-radius:2.5mm;
    overflow:hidden;background:#fff;
    page-break-inside:avoid;break-inside:avoid;
  }
  /* ── Header ── */
  .t-head{
    background:linear-gradient(135deg,#7c3aed 0%,#9333ea 55%,#db2777 100%);
    padding:2.5mm 3mm;display:flex;align-items:center;gap:2mm;
  }
  .t-logo{height:10mm;width:auto;object-fit:contain;flex-shrink:0;filter:brightness(0) invert(1)}
  .t-head-text{flex:1;min-width:0}
  .t-brand{font-size:5pt;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.1em;line-height:1;margin-bottom:.5mm}
  .t-event{font-size:8.5pt;font-weight:900;color:#fff;line-height:1.15;
    overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  .t-badge{
    font-size:5.5pt;font-weight:700;color:#fff;
    padding:.8mm 2.5mm;border-radius:10mm;
    background:rgba(0,0,0,.28);white-space:nowrap;flex-shrink:0
  }
  /* ── Body ── */
  .t-body{display:flex;padding:2.5mm 3mm;gap:2.5mm;align-items:center}
  .t-details{flex:1;min-width:0}
  .t-row{
    font-size:6.5pt;color:#4b5563;
    margin-bottom:1mm;display:flex;align-items:flex-start;gap:1.5mm;line-height:1.3
  }
  .t-icon{flex-shrink:0}
  .t-price{font-size:14pt;font-weight:900;color:#7c3aed;margin-top:2.5mm;line-height:1}
  .t-num{font-family:'Courier New',monospace;font-size:5.5pt;color:#9ca3af;margin-top:1.5mm;letter-spacing:.02em}
  .t-qr-wrap{flex-shrink:0;text-align:center}
  .t-qr{width:21mm;height:21mm;display:block;border:.3mm solid #e5e7eb;padding:.5mm;border-radius:1mm}
  .t-cash{font-size:5.5pt;font-weight:700;color:#6b7280;text-align:center;margin-top:1mm;text-transform:uppercase;letter-spacing:.05em}
  /* ── Footer ── */
  .t-foot{
    background:#f9fafb;border-top:.3mm solid #f3f4f6;
    padding:1.2mm 3mm;font-size:5pt;color:#9ca3af;text-align:center;letter-spacing:.02em
  }
  /* ── Stub ── */
  .stub{border-top:.5mm dashed #f97316;background:#fff7ed;padding:2mm 3mm 1.5mm}
  .stub-row{display:flex;justify-content:space-between;align-items:flex-start}
  .stub-lbl{font-size:5pt;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;margin-bottom:.5mm;line-height:1}
  .stub-code{font-size:15pt;font-weight:900;font-family:'Courier New',monospace;color:#ea580c;letter-spacing:2mm;line-height:1}
  .stub-right{text-align:right}
  .stub-num{font-size:5.5pt;font-family:'Courier New',monospace;color:#374151;font-weight:700}
  .stub-price{font-size:10pt;font-weight:900;color:#7c3aed;margin-top:1mm}
  .stub-note{font-size:5pt;color:#9ca3af;margin-top:1.5mm;border-top:.3mm solid #fed7aa;padding-top:1mm}
  @media print{body{background:#fff}}
</style></head><body>
<div class="page-hd">
  <div>
    <div class="page-title">NXT STOP &mdash; Physical Tickets</div>
    <div class="page-sub">${hcBatch.event.name} &nbsp;&middot;&nbsp; ${hcBatch.ticketType.name} &nbsp;&middot;&nbsp; ${hcBatch.tickets.length} tickets</div>
  </div>
  <div class="page-meta">
    Printed ${new Date().toLocaleString()}<br>
    &#9888; NOT YET SOLD &mdash; activate each ticket when cash is collected
  </div>
</div>
<div class="grid">${ticketHtml}</div>
<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1200)}</script>
</body></html>`)
    printWin.document.close()
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
                  <select value={hcEventId} onChange={e => { setHcEventId(e.target.value); setHcTicketTypeId(''); setHcBatch(null); setHcExistingCount(null) }}>
                    <option value="">Select event…</option>
                    {events.map(ev => (
                      <option key={ev.id} value={ev.id}>{ev.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Ticket Type *</label>
                  <select value={hcTicketTypeId} onChange={e => { setHcTicketTypeId(e.target.value); setHcBatch(null); checkExisting(hcEventId, e.target.value) }} disabled={!hcEventId}>
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
              {hcExistingCount !== null && hcExistingCount > 0 && !hcBatch && (
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-between gap-3">
                  <span className="text-sm text-blue-300">
                    <span className="font-bold">{hcExistingCount}</span> unsold physical ticket{hcExistingCount !== 1 ? 's' : ''} already exist for this event
                  </span>
                  <button
                    onClick={loadExistingBatch}
                    disabled={hcLoadingExisting}
                    className="flex items-center gap-1.5 text-xs bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 rounded-lg px-3 py-1.5 transition-colors shrink-0"
                  >
                    {hcLoadingExisting ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    {hcLoadingExisting ? 'Loading…' : 'Reload & Reprint'}
                  </button>
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
                  These tickets are <strong>NOT yet sold</strong>. They will only count as sales once the activation code on the stub is entered at <strong>/gate/activate</strong>.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {hcBatch.tickets.map(t => (
                    <button
                      type="button"
                      key={t.ticketNumber}
                      onClick={() => setPhysicalPreview({ event: hcBatch.event, ticketType: hcBatch.ticketType, ticket: t })}
                      className="bg-[#111] border border-[#2a2a2a] rounded-xl p-3 flex flex-col items-center gap-2 hover:border-purple-500/40 transition-colors text-left cursor-pointer"
                    >
                      <img src={t.qrDataUrl} alt={t.ticketNumber} className="w-20 h-20 rounded-lg bg-white p-1 pointer-events-none" />
                      <span className="text-xs font-mono text-gray-400 text-center break-all">{t.ticketNumber}</span>
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-xs text-gray-600 uppercase tracking-widest">Activation</span>
                        <span className="text-base font-black font-mono text-orange-400 tracking-widest">{t.activationCode}</span>
                      </div>
                      <span className="text-xs font-bold text-purple-400">{formatCurrency(hcBatch.ticketType.price)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Existing Physical Ticket Batches ── */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-white">Physical Ticket Inventory</h3>
                  <p className="text-gray-500 text-sm">All generated batches by event & ticket type</p>
                </div>
                <button onClick={loadBatches} disabled={batchesLoading} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors">
                  <RefreshCw size={12} className={batchesLoading ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>

              {batchesLoading && batches.length === 0 ? (
                <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
              ) : batches.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-8">No physical tickets generated yet.</p>
              ) : (
                <div className="space-y-2">
                  {batches.map(b => {
                    const key = `${b.eventId}:${b.ticketTypeId}`
                    const isExpanded = expandedBatch === key
                    return (
                      <div key={key}>
                        <button
                          onClick={() => expandBatch(b.eventId, b.ticketTypeId)}
                          className={`w-full card p-4 flex items-center gap-4 text-left transition-all ${isExpanded ? 'border-purple-500/40 bg-purple-500/5' : ''}`}
                        >
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: b.ticketType?.color ?? '#8B5CF6' }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold text-sm truncate">{b.event?.name ?? 'Unknown Event'}</p>
                            <p className="text-gray-500 text-xs">{b.ticketType?.name ?? '—'} · {b.event ? formatDate(b.event.date, 'MMM d, yyyy') : '—'}</p>
                          </div>
                          <div className="flex items-center gap-4 text-xs shrink-0">
                            <div className="text-center">
                              <p className="text-orange-400 font-bold text-base">{b.unsold}</p>
                              <p className="text-gray-600">unsold</p>
                            </div>
                            <div className="text-center">
                              <p className="text-green-400 font-bold text-base">{b.activated}</p>
                              <p className="text-gray-600">activated</p>
                            </div>
                            <div className="text-center">
                              <p className="text-white font-bold text-base">{b.unsold + b.activated}</p>
                              <p className="text-gray-600">total</p>
                            </div>
                          </div>
                          {isExpanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                        </button>

                        {isExpanded && (
                          <div className="mt-2 ml-4 border-l-2 border-purple-500/20 pl-4 pb-2">
                            {expandedLoading ? (
                              <div className="flex items-center gap-2 py-6 justify-center text-gray-500 text-sm">
                                <Loader2 size={16} className="animate-spin" /> Loading tickets…
                              </div>
                            ) : expandedTickets.length === 0 ? (
                              <p className="text-gray-600 text-sm py-4">No unsold physical tickets.</p>
                            ) : (
                              <>
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-xs text-gray-500">{expandedTickets.length} unsold ticket{expandedTickets.length !== 1 ? 's' : ''}</p>
                                  <button
                                    onClick={() => {
                                      if (!b.event || !b.ticketType) return
                                      setHcBatch({
                                        event: { name: b.event.name, date: b.event.date, venue: b.event.venue, posterImage: b.event.posterImage },
                                        ticketType: { name: b.ticketType.name, color: b.ticketType.color, price: b.ticketType.price },
                                        tickets: expandedTickets,
                                      })
                                    }}
                                    className="flex items-center gap-1.5 text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 rounded-lg px-3 py-1.5 transition-colors"
                                  >
                                    <Printer size={12} /> Print These
                                  </button>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                  {expandedTickets.map((t: any) => (
                                    <button
                                      type="button"
                                      key={t.ticketNumber}
                                      onClick={() => {
                                        if (!b.event || !b.ticketType) return
                                        setPhysicalPreview({
                                          event: { name: b.event.name, date: b.event.date, venue: b.event.venue, posterImage: b.event.posterImage },
                                          ticketType: { name: b.ticketType.name, color: b.ticketType.color, price: b.ticketType.price },
                                          ticket: t,
                                        })
                                      }}
                                      className="bg-[#111] border border-[#2a2a2a] rounded-xl p-2.5 flex flex-col items-center gap-1.5 hover:border-purple-500/40 transition-colors cursor-pointer text-left"
                                    >
                                      <img src={t.qrDataUrl} alt={t.ticketNumber} className="w-16 h-16 rounded-lg bg-white p-0.5 pointer-events-none" />
                                      <span className="text-[10px] font-mono text-gray-500 text-center break-all">{t.ticketNumber}</span>
                                      <span className="text-xs font-black font-mono text-orange-400 tracking-wider">{t.activationCode}</span>
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
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
                  placeholder={tab === 'tickets' ? 'Search name, phone, ticket #...' : 'Search name, phone, order #...'}
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
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setAdminTicketId(t.id)}
                      className="card p-4 flex items-center gap-4 w-full text-left hover:border-purple-500/35 transition-colors cursor-pointer"
                    >
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.ticketType.color }} />
                      <div className="flex-1 min-w-0 grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-white font-semibold truncate">{t.order?.recipientName || t.order?.guestName || t.user.name}</p>
                          <p className="text-gray-500 text-xs truncate">{t.user.phone}</p>
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
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[t.status] ?? STATUS_COLOR_EXTRA[t.status] ?? ''}`}>{t.status}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  {orders.length === 0 && <p className="text-gray-500 text-center py-12">No orders found.</p>}
                  {orders.map(o => (
                    <div key={o.id} className="card p-4">
                      <div
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer rounded-xl -m-1 p-1 hover:bg-white/[0.03] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40"
                        onClick={() => setOrderDetailId(o.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setOrderDetailId(o.id)
                          }
                        }}
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-1 min-w-0 grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-white font-semibold truncate">{o.guestName || o.user.name}</p>
                              <p className="text-gray-500 text-xs truncate">{o.guestPhone || o.user.phone}</p>
                            </div>
                            <div>
                              <p className="text-white font-mono text-xs">{o.orderNumber}</p>
                              <p className="text-gray-500 text-xs">{o.paymentMethod ?? '—'} · {formatCurrency(o.total)}</p>
                            </div>
                            <div>
                              <p className="text-gray-300 text-xs">{o.items.map(i => i.name).join(', ')}</p>
                              <p className="text-gray-500 text-xs">{formatDate(o.createdAt, 'MMM d, h:mm a')}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[o.status] ?? ''}`}>{o.status}</span>
                              <span className="text-[10px] text-purple-400 font-medium">Open details</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {o.tickets.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1 pl-0">
                          {o.tickets.map(t => (
                            <button
                              type="button"
                              key={t.id}
                              onClick={e => { e.stopPropagation(); setAdminTicketId(t.id) }}
                              className="text-xs font-mono bg-[#111] border border-[#2a2a2a] px-2 py-0.5 rounded hover:border-purple-500/40 transition-colors"
                            >
                              {t.ticketNumber} <span className="text-gray-600">· {t.status}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {o.status !== 'paid' && (
                        <div className="mt-3 flex flex-wrap gap-2" onClick={e => e.stopPropagation()}>
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

      {/* Full ticket (admin list) */}
      {adminTicketId && (
        <div
          className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => { setAdminTicketId(null); setAdminTicketData(null) }}
        >
          <div
            className="relative w-full max-w-md bg-[#101010] border border-[#2a2a2a] rounded-2xl shadow-2xl my-auto overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute top-3 right-3 z-10 text-gray-500 hover:text-white p-1"
              onClick={() => { setAdminTicketId(null); setAdminTicketData(null) }}
              aria-label="Close"
            >
              <X size={22} />
            </button>
            {adminTicketLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 size={28} className="animate-spin text-purple-500" />
              </div>
            ) : adminTicketData ? (
              <div className="p-6 pt-10">
                {adminTicketData.event?.posterImage && (
                  <img src={adminTicketData.event.posterImage} alt="" className="w-full h-36 object-cover rounded-xl mb-4 -mt-2" />
                )}
                <div className="flex items-start gap-3 mb-4">
                  <img src={LOGO_URL} alt="NXT STOP" className="h-16 w-auto max-w-[220px] object-contain object-left shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">NXT STOP</p>
                    <h2 className="text-lg font-black text-white leading-tight">{adminTicketData.event.name}</h2>
                    <span
                      className="inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full text-white mt-1"
                      style={{ background: adminTicketData.ticketType.color }}
                    >
                      {adminTicketData.ticketType.name}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5 text-sm text-gray-400 mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-purple-400 shrink-0" />
                    {formatDate(adminTicketData.event.date, 'EEE, MMM d, yyyy · h:mm a')}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-purple-400 shrink-0" />
                    {adminTicketData.event.venue}
                    {adminTicketData.event.address ? `, ${adminTicketData.event.address}` : ''}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-5 items-center border-t border-dashed border-[#2a2a2a] pt-5">
                  <img src={adminTicketData.qrDataUrl} alt="QR" className="w-36 h-36 rounded-xl bg-white p-1.5 border border-gray-200 shrink-0" />
                  <div className="flex-1 w-full min-w-0 space-y-2">
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest">Holder / account</p>
                      <p className="text-white font-semibold">{adminTicketData.user?.name}</p>
                      <a href={`tel:${adminTicketData.user?.phone}`} className="text-lg font-mono text-green-400 hover:text-green-300 break-all">
                        {adminTicketData.user?.phone}
                      </a>
                    </div>
                    {(adminTicketData.order?.recipientName || adminTicketData.order?.guestName) && (
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">On ticket</p>
                        <p className="text-gray-200">{adminTicketData.order?.recipientName || adminTicketData.order?.guestName}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest">Ticket no.</p>
                      <p className="font-mono text-sm text-gray-300 break-all">{adminTicketData.ticketNumber}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[adminTicketData.status] ?? STATUS_COLOR_EXTRA[adminTicketData.status] ?? ''}`}>
                        {adminTicketData.status}
                      </span>
                      <span className="text-purple-300 font-bold">{formatCurrency(money(adminTicketData.ticketType.price))}</span>
                    </div>
                    {adminTicketData.activationCode && (
                      <p className="text-xs text-orange-400 font-mono">Activation: {adminTicketData.activationCode}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="p-8 text-center text-gray-500">Could not load ticket.</p>
            )}
          </div>
        </div>
      )}

      {/* Order detail (call failed payments, etc.) */}
      {orderDetailId && (
        <div
          className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => { setOrderDetailId(null); setOrderDetailData(null) }}
        >
          <div
            className="relative w-full max-w-lg bg-[#101010] border border-[#2a2a2a] rounded-2xl shadow-2xl my-auto max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute top-3 right-3 z-10 text-gray-500 hover:text-white p-1"
              onClick={() => { setOrderDetailId(null); setOrderDetailData(null) }}
              aria-label="Close"
            >
              <X size={22} />
            </button>
            {orderDetailLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 size={28} className="animate-spin text-purple-500" />
              </div>
            ) : orderDetailData ? (
              <div className="p-6 pt-10 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Order</p>
                    <p className="font-mono text-white font-bold">{orderDetailData.orderNumber}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[orderDetailData.status] ?? ''}`}>
                    {orderDetailData.status}
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="bg-[#151515] rounded-xl p-3 border border-[#2a2a2a]">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Buyer</p>
                    <p className="text-white font-medium">{orderDetailData.user?.name}</p>
                    <a href={`tel:${orderDetailData.user?.phone}`} className="text-green-400 font-mono hover:text-green-300 break-all">
                      {orderDetailData.user?.phone}
                    </a>
                  </div>
                  <div className="bg-[#151515] rounded-xl p-3 border border-[#2a2a2a]">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Guest / recipient</p>
                    {orderDetailData.guestName || orderDetailData.guestPhone ? (
                      <>
                        <p className="text-white font-medium">{orderDetailData.guestName || '—'}</p>
                        {orderDetailData.guestPhone && (
                          <a href={`tel:${orderDetailData.guestPhone}`} className="text-green-400 font-mono hover:text-green-300 break-all">
                            {orderDetailData.guestPhone}
                          </a>
                        )}
                      </>
                    ) : (
                      <p className="text-gray-600">Same as buyer</p>
                    )}
                  </div>
                </div>
                {orderDetailData.recipientName && (
                  <div className="text-sm">
                    <span className="text-gray-500">Recipient on ticket: </span>
                    <span className="text-white">{orderDetailData.recipientName}</span>
                  </div>
                )}
                <div className="text-sm space-y-1 text-gray-400">
                  <p><span className="text-gray-600">Payment:</span> {orderDetailData.paymentMethod ?? '—'}</p>
                  <p className="font-mono break-all"><span className="text-gray-600">Ref:</span> {orderDetailData.paymentRef ?? '—'}</p>
                  <p><span className="text-gray-600">Created:</span> {formatDate(orderDetailData.createdAt, 'PPp')}</p>
                  {orderDetailData.paidAt && (
                    <p><span className="text-gray-600">Paid:</span> {formatDate(orderDetailData.paidAt, 'PPp')}</p>
                  )}
                </div>
                <div className="border border-[#2a2a2a] rounded-xl overflow-hidden">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest px-3 py-2 bg-[#151515]">Line items</p>
                  <ul className="divide-y divide-[#2a2a2a]">
                    {orderDetailData.items?.map((it: { id: string; name: string; quantity: number; price: unknown }) => (
                      <li key={it.id} className="px-3 py-2 flex justify-between text-sm">
                        <span className="text-gray-300">{it.name} × {it.quantity}</span>
                        <span className="text-white font-medium">{formatCurrency(money(it.price) * it.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="px-3 py-2 flex justify-between text-sm border-t border-[#2a2a2a] bg-[#151515]">
                    <span className="text-gray-500">Subtotal</span>
                    <span>{formatCurrency(money(orderDetailData.subtotal))}</span>
                  </div>
                  <div className="px-3 py-2 flex justify-between text-sm bg-[#151515]">
                    <span className="text-gray-500">Fees</span>
                    <span>{formatCurrency(money(orderDetailData.platformFees))}</span>
                  </div>
                  <div className="px-3 py-2 flex justify-between font-bold text-white bg-[#1a1a1a]">
                    <span>Total</span>
                    <span>{formatCurrency(money(orderDetailData.total))}</span>
                  </div>
                </div>
                {orderDetailData.tickets?.length > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Tickets</p>
                    <div className="flex flex-wrap gap-2">
                      {orderDetailData.tickets.map((tk: { id: string; ticketNumber: string; status: string }) => (
                        <button
                          type="button"
                          key={tk.id}
                          onClick={() => { setOrderDetailId(null); setOrderDetailData(null); setAdminTicketId(tk.id) }}
                          className="text-xs font-mono bg-[#151515] border border-[#2a2a2a] px-2 py-1 rounded hover:border-purple-500/40"
                        >
                          {tk.ticketNumber} · {tk.status}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="p-8 text-center text-gray-500">Could not load order.</p>
            )}
          </div>
        </div>
      )}

      {/* Physical ticket full view (hard copy tab) */}
      {physicalPreview && (
        <div
          className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setPhysicalPreview(null)}
        >
          <div
            className="relative w-full max-w-sm bg-gradient-to-br from-[#1a0a24] to-[#0a0a0a] border border-purple-500/20 rounded-2xl shadow-2xl my-auto overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <button type="button" className="absolute top-3 right-3 z-10 text-gray-400 hover:text-white" onClick={() => setPhysicalPreview(null)} aria-label="Close">
              <X size={22} />
            </button>
            {physicalPreview.event.posterImage && (
              <img src={physicalPreview.event.posterImage} alt="" className="w-full h-36 object-cover" />
            )}
            <div className="p-6 pt-10">
              <div className="flex items-start gap-3 mb-4">
                <img src={LOGO_URL} alt="" className="h-14 w-auto max-w-[200px] object-contain object-left invert shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-white/50 uppercase tracking-widest">Physical · not sold until activated</p>
                  <h2 className="text-lg font-black text-white leading-tight">{physicalPreview.event.name}</h2>
                  <span
                    className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full text-white mt-1"
                    style={{ background: physicalPreview.ticketType.color }}
                  >
                    {physicalPreview.ticketType.name}
                  </span>
                </div>
              </div>
              <div className="space-y-1 text-sm text-gray-400 mb-4">
                <div className="flex items-center gap-2"><Calendar size={14} />{formatDate(physicalPreview.event.date, 'EEE, MMM d, yyyy · h:mm a')}</div>
                <div className="flex items-center gap-2"><MapPin size={14} />{physicalPreview.event.venue}</div>
              </div>
              <div className="flex flex-col items-center gap-3 bg-black/30 rounded-2xl p-5 border border-white/5">
                <img src={physicalPreview.ticket.qrDataUrl} alt="QR" className="w-48 h-48 rounded-2xl bg-white p-2" />
                <p className="font-mono text-xs text-gray-500 break-all text-center">{physicalPreview.ticket.ticketNumber}</p>
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">Activation code</p>
                  <p className="text-2xl font-black font-mono text-orange-400 tracking-[0.2em]">{physicalPreview.ticket.activationCode}</p>
                </div>
                <p className="text-xl font-black text-purple-300">{formatCurrency(physicalPreview.ticketType.price)}</p>
              </div>
              <p className="text-[10px] text-center text-gray-600 mt-4 flex items-center justify-center gap-1">
                <QrCode size={12} /> Tap outside or ✕ to close
              </p>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
