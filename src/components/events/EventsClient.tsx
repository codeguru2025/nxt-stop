'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Calendar, MapPin, Search, SlidersHorizontal, ArrowRight } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'

type Event = {
  id: string; name: string; slug: string; date: string; venue: string
  description?: string; posterImage?: string; status: string
  ticketTypes: { name: string; price: number; capacity: number; sold: number }[]
  _count: { tickets: number }
}

export default function EventsClient() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/events?status=published&limit=50')
      .then(r => r.json())
      .then(d => { if (d.success) setEvents(d.data) })
      .finally(() => setLoading(false))
  }, [])

  const filtered = events.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.venue.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-black text-white mb-2">All Events</h1>
        <p className="text-gray-500">Premium nightlife experiences — secured, scanned, and unforgettable.</p>
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-8">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            placeholder="Search events or venues..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Events grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card overflow-hidden">
              <div className="skeleton h-52" />
              <div className="p-5">
                <div className="skeleton h-5 rounded mb-3 w-3/4" />
                <div className="skeleton h-4 rounded mb-2 w-1/2" />
                <div className="skeleton h-4 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🎵</div>
          <h3 className="text-xl font-semibold text-white mb-2">No Events Found</h3>
          <p className="text-gray-500">
            {search ? 'Try a different search term.' : 'Check back soon — events are being added.'}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(event => {
            const minPrice = Math.min(...event.ticketTypes.map(t => t.price))
            const totalCap = event.ticketTypes.reduce((s, t) => s + t.capacity, 0)
            const totalSold = event.ticketTypes.reduce((s, t) => s + t.sold, 0)
            const pct = totalCap > 0 ? (totalSold / totalCap) * 100 : 0
            const isLow = pct > 80

            return (
              <Link
                key={event.id}
                href={`/events/${event.slug}`}
                className="group card overflow-hidden hover:border-[#3a3a3a] transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-black/50"
              >
                <div className="relative h-52 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] overflow-hidden">
                  {event.posterImage ? (
                    <img src={event.posterImage} alt={event.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center flex-col gap-2">
                      <div className="text-5xl">🎧</div>
                    </div>
                  )}
                  {event.status === 'live' && (
                    <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md uppercase pulse-glow">LIVE</div>
                  )}
                  {isLow && (
                    <div className="absolute top-3 right-3 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-md">Selling Fast</div>
                  )}
                </div>

                <div className="p-5">
                  <h3 className="font-bold text-white group-hover:text-purple-300 transition-colors mb-3 text-lg">{event.name}</h3>

                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                      <Calendar size={13} />
                      <span>{formatDate(event.date, 'EEE, MMM d yyyy · h:mm a')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                      <MapPin size={13} />
                      <span>{event.venue}</span>
                    </div>
                  </div>

                  {/* Capacity bar */}
                  {totalCap > 0 && (
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>{totalSold} sold</span>
                        <span>{totalCap} capacity</span>
                      </div>
                      <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background: pct > 80 ? '#EF4444' : pct > 50 ? '#F59E0B' : '#8B5CF6'
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Ticket types preview */}
                  <div className="flex gap-1.5 flex-wrap mb-4">
                    {event.ticketTypes.slice(0, 3).map(t => (
                      <span key={t.name} className="text-xs bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded-md px-2 py-0.5">
                        {t.name} — {formatCurrency(t.price)}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#2a2a2a]">
                    <div>
                      <div className="text-xs text-gray-600">From</div>
                      <div className="text-xl font-black text-white">{formatCurrency(minPrice)}</div>
                    </div>
                    <span className="bg-purple-600 group-hover:bg-purple-500 text-white rounded-lg px-5 py-2.5 text-sm font-bold transition-colors flex items-center gap-1.5">
                      Buy Now <ArrowRight size={14} />
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
