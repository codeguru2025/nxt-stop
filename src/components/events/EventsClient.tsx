'use client'

import { useState, useMemo, memo } from 'react'
import Link from 'next/link'
import { Calendar, MapPin, Search, ArrowRight, Filter, X } from 'lucide-react'
import { formatDate, formatCurrency, getEventTimePhase, type EventTimePhase } from '@/lib/utils'

type Event = {
  id: string; name: string; slug: string; date: string; endDate?: string; venue: string
  description?: string; posterImage?: string; status: string
  ticketTypes: { name: string; price: number; capacity: number; sold: number }[]
  _count: { tickets: number }
}

function phaseBadge(phase: EventTimePhase) {
  if (phase === 'live') {
    return <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md uppercase pulse-glow">Live</div>
  }
  if (phase === 'upcoming') {
    return <div className="absolute top-3 left-3 bg-sky-600 text-white text-xs font-bold px-2 py-1 rounded-md uppercase">Coming soon</div>
  }
  return <div className="absolute top-3 left-3 bg-zinc-600 text-white text-xs font-bold px-2 py-1 rounded-md uppercase">Ended</div>
}

const EventCard = memo(function EventCard({ event, referral }: { event: Event; referral?: string }) {
  const [imgError, setImgError] = useState(false)
  const eventUrl = referral ? `/events/${event.slug}?ref=${referral}` : `/events/${event.slug}`
  const timePhase = getEventTimePhase(event.date, event.endDate)

  const minPrice = event.ticketTypes.length > 0 ? Math.min(...event.ticketTypes.map(t => t.price)) : 0
  const totalCap = event.ticketTypes.reduce((s, t) => s + t.capacity, 0)
  const totalSold = event.ticketTypes.reduce((s, t) => s + t.sold, 0)
  const pct = totalCap > 0 ? (totalSold / totalCap) * 100 : 0
  const isLow = pct > 80 && timePhase !== 'ended'

  return (
    <Link
      href={eventUrl}
      className={`group card overflow-hidden hover:border-[#3a3a3a] transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-black/50 ${timePhase === 'ended' ? 'opacity-75' : ''}`}
    >
      <div className="relative h-52 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] overflow-hidden">
        {event.posterImage && !imgError ? (
          <img
            src={event.posterImage}
            alt={event.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center flex-col gap-2">
            <div className="text-5xl">🎧</div>
          </div>
        )}
        {phaseBadge(timePhase)}
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
                  background: pct > 80 ? '#EF4444' : pct > 50 ? '#F59E0B' : '#E8174A'
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
})

type EventsPageProps = { initialEvents: Event[]; referralRef?: string }

export default function EventsClient({ initialEvents, referralRef = '' }: EventsPageProps) {
  const events = initialEvents
  const [search, setSearch] = useState('')
  const [venueFilter, setVenueFilter] = useState('')
  const [phaseFilter, setPhaseFilter] = useState<'' | 'upcoming' | 'live' | 'ended'>('')
  const ref = referralRef

  const venues = useMemo(() => {
    const seen = new Set<string>()
    return events.map(e => e.venue).filter(v => { if (seen.has(v)) return false; seen.add(v); return true }).sort()
  }, [events])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return events.filter(e => {
      if (q && !e.name.toLowerCase().includes(q) && !e.venue.toLowerCase().includes(q)) return false
      if (venueFilter && e.venue !== venueFilter) return false
      if (phaseFilter && getEventTimePhase(e.date, e.endDate) !== phaseFilter) return false
      return true
    })
  }, [events, search, venueFilter, phaseFilter])

  const sorted = useMemo(() => {
    const rank: Record<EventTimePhase, number> = { upcoming: 0, live: 1, ended: 2 }
    return [...filtered].sort((a, b) => {
      const pa = getEventTimePhase(a.date, a.endDate)
      const pb = getEventTimePhase(b.date, b.endDate)
      if (rank[pa] !== rank[pb]) return rank[pa] - rank[pb]
      return new Date(a.date).getTime() - new Date(b.date).getTime()
    })
  }, [filtered])

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-black text-white mb-2">All Events</h1>
        <p className="text-gray-500">Premium nightlife experiences — secured, scanned, and unforgettable.</p>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-3 mb-8 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            placeholder="Search events or venues..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 w-full"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-500 shrink-0" />
          <select
            value={phaseFilter}
            onChange={e => setPhaseFilter(e.target.value as typeof phaseFilter)}
            className="text-sm py-2 px-3 min-w-[120px]"
          >
            <option value="">All dates</option>
            <option value="upcoming">Upcoming</option>
            <option value="live">Live now</option>
            <option value="ended">Ended</option>
          </select>

          {venues.length > 1 && (
            <select
              value={venueFilter}
              onChange={e => setVenueFilter(e.target.value)}
              className="text-sm py-2 px-3 min-w-[140px]"
            >
              <option value="">All venues</option>
              {venues.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          )}

          {(phaseFilter || venueFilter || search) && (
            <button
              onClick={() => { setSearch(''); setVenueFilter(''); setPhaseFilter('') }}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-white border border-[#2a2a2a] rounded-lg px-2.5 py-2 transition-colors"
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Events grid */}
      {sorted.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🎵</div>
          <h3 className="text-xl font-semibold text-white mb-2">No Events Found</h3>
          <p className="text-gray-500">
            {(search || venueFilter || phaseFilter) ? 'Try adjusting your filters.' : 'Check back soon — events are being added.'}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sorted.map(event => <EventCard key={event.id} event={event} referral={ref || undefined} />)}
        </div>
      )}
    </div>
  )
}
