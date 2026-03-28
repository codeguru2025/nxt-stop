'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Calendar, MapPin, Printer, Download, X, ExternalLink, Ticket } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'

type TicketData = {
  id: string
  ticketNumber: string
  qrCode: string
  qrDataUrl: string
  status: string
  createdAt: string
  event: {
    id: string; name: string; slug: string; date: string; endDate?: string
    venue: string; address?: string; posterImage?: string; lat?: number; lng?: number
  }
  ticketType: { name: string; color: string; price: number }
  order?: { total: number; subtotal: number; recipientName?: string }
}

const LOGO_URL = 'https://nxt-stop.lon1.cdn.digitaloceanspaces.com/nxt-stop%20logo.jpeg'

function TicketModal({ ticket, onClose }: { ticket: TicketData; onClose: () => void }) {
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    const printWin = window.open('', '_blank', 'width=640,height=960')
    if (!printWin || !printRef.current) return
    printWin.document.write(`<!DOCTYPE html><html><head><title>Ticket</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;font-family:-apple-system,sans-serif}
      body{background:#fff;padding:24px}
      .ticket{max-width:480px;margin:0 auto;border:2px solid #e5e7eb;border-radius:16px;overflow:hidden}
      .poster{width:100%;height:160px;object-fit:cover}
      .noposter{width:100%;height:100px;background:linear-gradient(135deg,#7c3aed,#db2777)}
      .body{padding:20px}
      .logo{width:44px;height:44px;border-radius:8px;object-fit:cover}
      h2{font-size:20px;font-weight:900;color:#111;line-height:1.2}
      .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;color:#fff;margin-top:6px}
      .row{display:flex;align-items:center;gap:6px;font-size:13px;color:#555;margin-bottom:6px}
      hr{border:none;border-top:2px dashed #e5e7eb;margin:16px 0}
      .qr-wrap{display:flex;gap:16px;align-items:center}
      .qr{width:110px;height:110px;border:1px solid #e5e7eb;padding:3px;border-radius:8px}
      .lbl{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;margin-bottom:2px}
      .val{font-size:13px;font-weight:700;color:#111;margin-bottom:8px}
      .mono{font-family:monospace;font-size:12px;color:#555}
      .price{font-size:24px;font-weight:900;color:#7c3aed}
      .status{font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;display:inline-block;margin-top:6px}
      .valid{background:#dcfce7;color:#16a34a}
      .used{background:#f3f4f6;color:#6b7280}
      .footer{background:#f9fafb;padding:10px;text-align:center;font-size:10px;color:#9ca3af;border-top:1px solid #f3f4f6}
    </style></head><body>
    ${printRef.current.innerHTML}
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}</script>
    </body></html>`)
    printWin.document.close()
  }

  const handleDownloadQR = () => {
    const a = document.createElement('a')
    a.href = ticket.qrDataUrl
    a.download = `ticket-${ticket.ticketNumber}.png`
    a.click()
  }

  const directionsUrl = ticket.event.lat && ticket.event.lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${ticket.event.lat},${ticket.event.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${ticket.event.venue} ${ticket.event.address ?? ''}`)}`

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="relative w-full max-w-md my-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-2">
            <button onClick={handlePrint} className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 text-white rounded-lg px-3 py-2 transition-colors font-medium">
              <Printer size={13} /> Print
            </button>
            <button onClick={handleDownloadQR} className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 text-white rounded-lg px-3 py-2 transition-colors font-medium">
              <Download size={13} /> Save QR
            </button>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* The actual printable ticket */}
        <div ref={printRef}>
          <div className="ticket bg-white rounded-2xl overflow-hidden shadow-2xl">
            {ticket.event.posterImage ? (
              <img src={ticket.event.posterImage} alt={ticket.event.name} className="poster w-full h-44 object-cover" />
            ) : (
              <div className="noposter w-full h-28 bg-gradient-to-br from-purple-700 to-pink-600" />
            )}

            <div className="body p-6">
              <div className="flex items-start gap-3 mb-4">
                <img src={LOGO_URL} alt="NXT STOP" className="logo w-11 h-11 rounded-lg object-cover shrink-0" />
                <div>
                  <p className="lbl text-xs text-gray-400 uppercase tracking-widest font-semibold">NXT STOP</p>
                  <h2 className="text-xl font-black text-gray-900 leading-tight">{ticket.event.name}</h2>
                  <span className="badge text-xs font-bold px-3 py-1 rounded-full text-white" style={{ background: ticket.ticketType.color }}>
                    {ticket.ticketType.name}
                  </span>
                </div>
              </div>

              <div className="space-y-2 mb-5">
                <div className="row flex items-center gap-2 text-sm text-gray-600">
                  <span>📅</span><span>{formatDate(ticket.event.date, 'EEEE, MMMM d, yyyy')}</span>
                </div>
                <div className="row flex items-center gap-2 text-sm text-gray-600">
                  <span>🕙</span>
                  <span>
                    {formatDate(ticket.event.date, 'h:mm a')}
                    {ticket.event.endDate ? ` – ${formatDate(ticket.event.endDate, 'h:mm a')}` : ''}
                  </span>
                </div>
                <div className="row flex items-center gap-2 text-sm text-gray-600">
                  <span>📍</span>
                  <span>{ticket.event.venue}{ticket.event.address ? `, ${ticket.event.address}` : ''}</span>
                </div>
              </div>

              <hr className="border-dashed border-gray-200 my-5" />

              <div className="qr-wrap flex gap-5 items-center">
                <img src={ticket.qrDataUrl} alt="QR Code" className="qr w-28 h-28 rounded-xl bg-white p-1 border border-gray-200" />
                <div className="flex-1">
                  {ticket.order?.recipientName && (
                    <div className="mb-3">
                      <p className="lbl text-xs text-gray-400 uppercase tracking-widest">For</p>
                      <p className="val font-bold text-gray-900">{ticket.order.recipientName}</p>
                    </div>
                  )}
                  <p className="lbl text-xs text-gray-400 uppercase tracking-widest">Ticket No.</p>
                  <p className="mono text-sm font-mono text-gray-500 mb-3 break-all">{ticket.ticketNumber}</p>
                  <p className="lbl text-xs text-gray-400 uppercase tracking-widest">Price</p>
                  <p className="price text-2xl font-black text-purple-600">{formatCurrency(ticket.ticketType.price)}</p>
                  <span className={`status inline-block mt-2 text-xs font-bold px-2 py-0.5 rounded-full ${
                    ticket.status === 'valid' ? 'bg-green-100 text-green-700' :
                    ticket.status === 'used'  ? 'bg-gray-100 text-gray-500' :
                    'bg-red-100 text-red-600'
                  }`}>
                    {ticket.status.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            <div className="footer bg-gray-50 px-6 py-3 text-center border-t border-gray-100">
              <p className="text-xs text-gray-400">Present this QR code at the gate · nxtstop.com</p>
            </div>
          </div>
        </div>

        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 mt-3 text-xs text-gray-400 hover:text-white transition-colors"
        >
          <ExternalLink size={11} /> Get Directions to {ticket.event.venue}
        </a>
      </div>
    </div>
  )
}

export default function TicketsClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tickets, setTickets] = useState<TicketData[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<TicketData | null>(null)

  useEffect(() => {
    const guestToken = searchParams.get('guestToken')
    const url = guestToken ? `/api/tickets?guestToken=${guestToken}` : '/api/tickets'

    if (!guestToken) {
      fetch('/api/auth/me').then(r => r.json()).then(d => {
        if (!d.success) router.push('/login')
      })
    }

    fetch(url).then(r => r.json()).then(d => {
      if (d.success) setTickets(d.data)
    }).finally(() => setLoading(false))
  }, [router, searchParams])

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-40 rounded-xl" />)}
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
          <Ticket size={20} className="text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">My Tickets</h1>
          <p className="text-gray-500 text-sm">{tickets.length} ticket{tickets.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🎟️</div>
          <h3 className="text-xl font-semibold text-white mb-2">No tickets yet</h3>
          <p className="text-gray-500 mb-6">Browse upcoming events and grab your tickets.</p>
          <a href="/events" className="btn-primary inline-flex">Browse Events</a>
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map(ticket => (
            <button
              key={ticket.id}
              onClick={() => setSelected(ticket)}
              className="ticket-card w-full p-5 text-left hover:border-purple-500/40 transition-all"
            >
              <div className="flex gap-4">
                <div className="shrink-0">
                  <img src={ticket.qrDataUrl} alt="QR Code" className="w-24 h-24 rounded-xl bg-white p-1" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-bold text-white truncate">{ticket.event.name}</h3>
                    <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
                      ticket.status === 'valid' ? 'bg-green-500/20 text-green-400' :
                      ticket.status === 'used'  ? 'bg-gray-500/20 text-gray-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {ticket.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm mb-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: ticket.ticketType.color }} />
                    <span className="text-purple-300 font-medium">{ticket.ticketType.name}</span>
                    <span className="text-gray-600">·</span>
                    <span className="text-white font-semibold">{formatCurrency(ticket.ticketType.price)}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                      <Calendar size={11} />{formatDate(ticket.event.date, 'EEE, MMM d yyyy · h:mm a')}
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                      <MapPin size={11} />{ticket.event.venue}{ticket.event.address ? `, ${ticket.event.address}` : ''}
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                    <span className="text-xs text-gray-600 font-mono">{ticket.ticketNumber}</span>
                    <span className="text-xs text-purple-400 font-medium">Tap to view full ticket →</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && <TicketModal ticket={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
