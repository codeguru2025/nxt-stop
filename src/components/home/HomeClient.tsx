'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Calendar, MapPin, Users, Zap, Shield, Star, ArrowRight, Play, Clock } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'

type Event = {
  id: string
  name: string
  slug: string
  date: string
  venue: string
  posterImage?: string
  status: string
  ticketTypes: { name: string; price: number }[]
  _count: { tickets: number }
}

function Countdown({ date }: { date: string }) {
  const [time, setTime] = useState({ d: 0, h: 0, m: 0, s: 0 })

  useEffect(() => {
    const tick = () => {
      const diff = new Date(date).getTime() - Date.now()
      if (diff <= 0) return
      setTime({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [date])

  return (
    <div className="flex gap-3">
      {[
        { v: time.d, l: 'Days' },
        { v: time.h, l: 'Hours' },
        { v: time.m, l: 'Mins' },
        { v: time.s, l: 'Secs' },
      ].map(({ v, l }) => (
        <div key={l} className="countdown-box">
          <div className="text-2xl font-black text-purple-400">{String(v).padStart(2, '0')}</div>
          <div className="text-xs text-gray-500 mt-0.5">{l}</div>
        </div>
      ))}
    </div>
  )
}

export default function HomeClient() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/events?status=published&limit=6')
      .then(r => r.json())
      .then(d => { if (d.success) setEvents(d.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const featured = events[0]

  return (
    <>
      {/* Hero */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-black to-pink-900/20" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-600/20 rounded-full blur-[120px]" />
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: 'linear-gradient(rgba(139,92,246,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.5) 1px, transparent 1px)',
            backgroundSize: '60px 60px'
          }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 pt-24 pb-16 w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-1.5 mb-6">
                <div className="w-2 h-2 rounded-full bg-purple-400 pulse-glow" />
                <span className="text-purple-300 text-sm font-medium">Zimbabwe's Premium Event Platform</span>
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-none mb-6">
                <span className="text-white">THE NEXT</span>
                <br />
                <span className="gradient-text">STOP IS</span>
                <br />
                <span className="text-white">YOURS.</span>
              </h1>

              <p className="text-gray-400 text-lg leading-relaxed mb-8 max-w-md">
                Secure tickets. Real-time entry. Exclusive rewards. Experience premium nightlife like never before.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/events"
                  className="inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl px-8 py-4 font-bold text-lg transition-all hover:shadow-lg hover:shadow-purple-500/25 hover:-translate-y-0.5"
                >
                  Browse Events
                  <ArrowRight size={20} />
                </Link>
                {featured && (
                  <Link
                    href={`/events/${featured.slug}`}
                    className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl px-8 py-4 font-semibold transition-all"
                  >
                    <Play size={16} />
                    Next Event
                  </Link>
                )}
              </div>

              {/* Stats */}
              <div className="flex gap-8 mt-12 pt-8 border-t border-white/5">
                {[
                  { label: 'Events Hosted', value: '50+' },
                  { label: 'Tickets Sold', value: '25K+' },
                  { label: 'Partner DJs', value: '100+' },
                ].map(s => (
                  <div key={s.label}>
                    <div className="text-2xl font-black text-white">{s.value}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Featured event card */}
            {featured && (
              <div className="relative">
                <div className="relative bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-2xl border border-purple-500/20 overflow-hidden glow-purple">
                  {/* Event image placeholder */}
                  <div className="h-48 bg-gradient-to-br from-purple-900/50 to-pink-900/30 flex items-center justify-center">
                    {featured.posterImage ? (
                      <img src={featured.posterImage} alt={featured.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center">
                        <div className="text-6xl mb-2">🎵</div>
                        <div className="text-purple-400 font-semibold">NEXT EVENT</div>
                      </div>
                    )}
                  </div>

                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-green-400 pulse-glow" />
                      <span className="text-green-400 text-xs font-medium uppercase tracking-wider">On Sale Now</span>
                    </div>

                    <h3 className="text-xl font-bold text-white mb-2">{featured.name}</h3>

                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                      <Calendar size={14} />
                      <span>{formatDate(featured.date, 'EEEE, MMMM d, yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-4">
                      <MapPin size={14} />
                      <span>{featured.venue}</span>
                    </div>

                    <Countdown date={featured.date} />

                    <div className="flex items-center justify-between mt-5">
                      <div>
                        <div className="text-xs text-gray-500">From</div>
                        <div className="text-2xl font-black text-white">
                          {formatCurrency(Math.min(...featured.ticketTypes.map(t => t.price)))}
                        </div>
                      </div>
                      <Link
                        href={`/events/${featured.slug}`}
                        className="bg-purple-600 hover:bg-purple-500 text-white rounded-xl px-6 py-3 font-bold transition-all hover:shadow-lg hover:shadow-purple-500/25"
                      >
                        Buy Ticket
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Floating badge */}
                <div className="absolute -top-4 -right-4 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl px-4 py-2 shadow-xl">
                  <div className="text-white font-black text-sm">🔥 HOT</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 border-t border-[#1a1a1a]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-black text-white mb-3">
              A Platform Built Different
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              From secure ticketing to real-time event ops — everything you need, nothing you don't.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: Shield,
                color: 'text-purple-400',
                bg: 'bg-purple-500/10',
                title: 'Anti-Fraud Tickets',
                desc: 'Every ticket gets a unique QR code. One scan, one entry. No duplicates. No fakes.',
              },
              {
                icon: Zap,
                color: 'text-yellow-400',
                bg: 'bg-yellow-500/10',
                title: 'Instant Gate Scan',
                desc: 'Scan results in milliseconds. Real-time validation with full audit trail.',
              },
              {
                icon: Star,
                color: 'text-green-400',
                bg: 'bg-green-500/10',
                title: 'Referral Rewards',
                desc: 'Share your link, earn points. Redeem for drinks, upgrades, and free entry.',
              },
              {
                icon: Users,
                color: 'text-pink-400',
                bg: 'bg-pink-500/10',
                title: 'Partner Network',
                desc: 'DJs, influencers, and pharmacies sell your tickets and earn commissions automatically.',
              },
              {
                icon: Clock,
                color: 'text-blue-400',
                bg: 'bg-blue-500/10',
                title: 'Virtual Attendance',
                desc: "Can't make it? Stream the event live with paid virtual access.",
              },
              {
                icon: Calendar,
                color: 'text-orange-400',
                bg: 'bg-orange-500/10',
                title: 'Live Event Store',
                desc: 'Drinks, merch, and products sold in real-time with live stock tracking.',
              },
            ].map(f => (
              <div key={f.title} className="stat-card hover:border-[#3a3a3a] transition-colors group">
                <div className={`w-10 h-10 rounded-xl ${f.bg} flex items-center justify-center mb-4`}>
                  <f.icon size={20} className={f.color} />
                </div>
                <h3 className="font-bold text-white mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Upcoming Events */}
      <section className="py-20 border-t border-[#1a1a1a]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-3xl font-black text-white">Upcoming Events</h2>
              <p className="text-gray-500 mt-1">Don't miss what's next</p>
            </div>
            <Link href="/events" className="text-purple-400 hover:text-purple-300 text-sm font-medium flex items-center gap-1 transition-colors">
              View all <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="card overflow-hidden">
                  <div className="skeleton h-48" />
                  <div className="p-4">
                    <div className="skeleton h-5 rounded mb-3 w-3/4" />
                    <div className="skeleton h-4 rounded mb-2 w-1/2" />
                    <div className="skeleton h-4 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">🎵</div>
              <p className="text-gray-500">No upcoming events — check back soon.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map(event => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Referral CTA */}
      <section className="py-20 border-t border-[#1a1a1a]">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="relative bg-gradient-to-br from-purple-900/30 to-pink-900/20 rounded-2xl border border-purple-500/20 p-12 overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: 'radial-gradient(circle, rgba(139,92,246,0.5) 1px, transparent 1px)',
              backgroundSize: '30px 30px'
            }} />
            <div className="relative">
              <div className="text-5xl mb-4">💸</div>
              <h2 className="text-3xl font-black text-white mb-4">
                Turn Your Network Into <span className="gradient-text">Rewards</span>
              </h2>
              <p className="text-gray-400 max-w-lg mx-auto mb-8">
                Share your unique referral link. Every ticket your friends buy earns you points — redeemable for drinks, upgrades, and free entry.
              </p>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl px-8 py-4 font-bold text-lg transition-all hover:shadow-lg hover:shadow-purple-500/25"
              >
                Get Your Link — It's Free
                <ArrowRight size={20} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function EventCard({ event }: { event: Event }) {
  const minPrice = Math.min(...(event.ticketTypes?.map(t => t.price) ?? [0]))
  const isFeatured = event.status === 'live'

  return (
    <Link href={`/events/${event.slug}`} className="group card overflow-hidden hover:border-[#3a3a3a] transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-black/50">
      {/* Image */}
      <div className="relative h-48 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] overflow-hidden">
        {event.posterImage ? (
          <img src={event.posterImage} alt={event.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-5xl">🎵</div>
          </div>
        )}
        {isFeatured && (
          <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wide pulse-glow">
            LIVE NOW
          </div>
        )}
        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-md">
          From {formatCurrency(minPrice)}
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-bold text-white group-hover:text-purple-300 transition-colors truncate mb-2">{event.name}</h3>
        <div className="flex items-center gap-1.5 text-gray-500 text-sm mb-1">
          <Calendar size={13} />
          <span>{formatDate(event.date, 'EEE, MMM d · h:mm a')}</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-500 text-sm">
          <MapPin size={13} />
          <span className="truncate">{event.venue}</span>
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#2a2a2a]">
          <span className="text-xs text-gray-600">{event._count.tickets} sold</span>
          <span className="text-sm font-semibold text-purple-400 group-hover:text-purple-300 transition-colors flex items-center gap-1">
            Buy Ticket <ArrowRight size={13} />
          </span>
        </div>
      </div>
    </Link>
  )
}
