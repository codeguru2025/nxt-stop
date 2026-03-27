'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, MapPin, Download, Loader2, Ticket } from 'lucide-react'
import { formatDate } from '@/lib/utils'

type Ticket = {
  id: string
  ticketNumber: string
  qrCode: string
  qrDataUrl: string
  status: string
  createdAt: string
  event: { id: string; name: string; date: string; venue: string; address?: string; posterImage?: string }
  ticketType: { name: string; color: string }
}

export default function TicketsClient() {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.success) { router.push('/login'); return }
    })
    fetch('/api/tickets').then(r => r.json()).then(d => {
      if (d.success) setTickets(d.data)
    }).finally(() => setLoading(false))
  }, [router])

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
        <div className="space-y-5">
          {tickets.map(ticket => (
            <div key={ticket.id} className="ticket-card p-5">
              <div className="flex gap-4">
                {/* QR Code */}
                <div className="shrink-0">
                  <img
                    src={ticket.qrDataUrl}
                    alt="QR Code"
                    className="w-28 h-28 rounded-xl bg-white p-1"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-bold text-white truncate">{ticket.event.name}</h3>
                    <span
                      className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
                        ticket.status === 'valid' ? 'bg-green-500/20 text-green-400' :
                        ticket.status === 'used' ? 'bg-gray-500/20 text-gray-400' :
                        'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {ticket.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-sm text-purple-300 mb-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: ticket.ticketType.color }} />
                    {ticket.ticketType.name}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                      <Calendar size={11} />
                      {formatDate(ticket.event.date, 'EEE, MMM d yyyy · h:mm a')}
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                      <MapPin size={11} />
                      {ticket.event.venue}
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                    <span className="text-xs text-gray-600 font-mono">{ticket.ticketNumber}</span>
                    <button
                      onClick={() => {
                        const a = document.createElement('a')
                        a.href = ticket.qrDataUrl
                        a.download = `ticket-${ticket.ticketNumber}.png`
                        a.click()
                      }}
                      className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      <Download size={12} />
                      Save QR
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
