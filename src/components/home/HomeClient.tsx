'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Calendar, MapPin, ArrowRight, Play } from 'lucide-react'
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
          <Image
            src="https://nxt-stop.lon1.cdn.digitaloceanspaces.com/BigQ%20on%20deck.jpeg"
            alt=""
            fill
            priority
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/60 to-purple-900/50" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-600/20 rounded-full blur-[120px]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 pt-24 pb-16 w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-1.5 mb-6">
                <div className="w-2 h-2 rounded-full bg-purple-400 pulse-glow" />
                <span className="text-purple-300 text-sm font-medium">Plumtree · Bulawayo · Harare · Johannesburg</span>
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-none mb-6">
                <span className="text-white">THE NEXT</span>
                <br />
                <span className="gradient-text">STOP IS</span>
                <br />
                <span className="text-white">YOURS.</span>
              </h1>

              <p className="text-gray-400 text-lg leading-relaxed mb-8 max-w-md">
                Zimbabwe's hottest nights. The artists. The energy. The culture. This is where it happens.
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
                  <div className="relative h-48 bg-gradient-to-br from-purple-900/50 to-pink-900/30">
                    {featured.posterImage ? (
                      <Image
                        src={featured.posterImage}
                        alt={featured.name}
                        fill
                        priority
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-6xl mb-2">🎵</div>
                          <div className="text-purple-400 font-semibold">NEXT EVENT</div>
                        </div>
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

      {/* Next Event Spotlight */}
      <section className="py-20 border-t border-[#1a1a1a] bg-gradient-to-b from-[#0a0a0a] to-[#0f0a1a]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-1.5 mb-8">
            <div className="w-2 h-2 rounded-full bg-green-400 pulse-glow" />
            <span className="text-purple-300 text-sm font-medium">Next Event — 29 August 2026</span>
          </div>

          <div className="grid lg:grid-cols-2 gap-10 items-center">
            {/* Artists */}
            <div className="relative">
              <div className="grid grid-cols-5 gap-3 items-end">
                {/* Dlala Thukzin — headline */}
                <div className="col-span-3 relative rounded-2xl overflow-hidden aspect-[3/4]">
                  <Image
                    src="https://nxt-stop.lon1.cdn.digitaloceanspaces.com/DLALA%20THUKZIN.jpeg"
                    alt="Dlala Thukzin"
                    fill
                    priority
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4">
                    <p className="text-white/60 text-xs uppercase tracking-widest mb-1">Headline Act</p>
                    <p className="text-white font-black text-xl leading-tight">Dlala Thukzin</p>
                  </div>
                </div>
                {/* Mzoe7 — MC */}
                <div className="col-span-2 relative rounded-2xl overflow-hidden aspect-[3/4]">
                  <Image
                    src="https://nxt-stop.lon1.cdn.digitaloceanspaces.com/Mzoe7.jpeg"
                    alt="Mzoe7"
                    fill
                    priority
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-3">
                    <p className="text-purple-400 text-xs font-medium uppercase tracking-wider mb-1">MC</p>
                    <p className="text-white font-black text-lg leading-tight">Mzoe7</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="lg:pl-6 pt-4 lg:pt-0">
              <h2 className="text-4xl sm:text-5xl font-black text-white leading-none mb-2">
                NXT STOP
              </h2>
              <h3 className="text-2xl sm:text-3xl font-black gradient-text mb-6">
                Dlala Thukzin Live
              </h3>

              <div className="space-y-3 mb-8">
                {[
                  { icon: '📍', label: 'Venue', value: 'ZITF Pavilion, Bulawayo' },
                  { icon: '📅', label: 'Date', value: 'Friday, 29 August 2026' },
                  { icon: '🕗', label: 'Doors', value: '12:00 PM — 10:00 PM' },
                ].map(d => (
                  <div key={d.label} className="flex items-center gap-3">
                    <span className="text-xl">{d.icon}</span>
                    <div>
                      <span className="text-gray-500 text-xs uppercase tracking-wider">{d.label}</span>
                      <p className="text-white font-semibold">{d.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 mb-8">
                {['Corrason', 'Dlala Thukzin', 'Big Q', 'Yugo'].map(a => (
                  <span key={a} className="bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm font-medium px-3 py-1 rounded-full">
                    {a}
                  </span>
                ))}
              </div>

              <a
                href="/events/nxt-stop-bulawayo-dlala-thukzin-2026"
                className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl px-8 py-4 font-bold text-lg transition-all hover:shadow-lg hover:shadow-purple-500/25 hover:-translate-y-0.5"
              >
                Get Tickets
                <ArrowRight size={20} />
              </a>
            </div>
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

      {/* Gallery */}
      <section className="py-20 border-t border-[#1a1a1a]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black text-white">The Vibe</h2>
            <p className="text-gray-500 mt-1">NXT STOP in action</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              'https://nxt-stop.lon1.cdn.digitaloceanspaces.com/Corrason.jpeg',
              'https://nxt-stop.lon1.cdn.digitaloceanspaces.com/Corrason%202.jpeg',
              'https://nxt-stop.lon1.cdn.digitaloceanspaces.com/Big%20Q%202.jpeg',
              'https://nxt-stop.lon1.cdn.digitaloceanspaces.com/Big%20Q%203.jpeg',
              'https://nxt-stop.lon1.cdn.digitaloceanspaces.com/Corrason%203.jpeg',
              'https://nxt-stop.lon1.cdn.digitaloceanspaces.com/Yugo%202.jpeg',
              'https://nxt-stop.lon1.cdn.digitaloceanspaces.com/Big%20Q%206.jpeg',
              'https://nxt-stop.lon1.cdn.digitaloceanspaces.com/Corrason%205.jpeg',
              'https://nxt-stop.lon1.cdn.digitaloceanspaces.com/Yugo%203.jpeg',
              'https://nxt-stop.lon1.cdn.digitaloceanspaces.com/Big%20Q%207.jpeg',
              'https://nxt-stop.lon1.cdn.digitaloceanspaces.com/Yugo%204.jpeg',
              'https://nxt-stop.lon1.cdn.digitaloceanspaces.com/BigQ%20on%20deck.jpeg',
            ].map((url, i) => (
              <div
                key={i}
                className={`relative overflow-hidden rounded-xl bg-[#1a1a1a] aspect-square ${i === 0 || i === 7 ? 'col-span-2 row-span-2' : ''}`}
              >
                <Image
                  src={url}
                  alt={`NXT STOP ${i + 1}`}
                  fill
                  className="object-cover hover:scale-105 transition-transform duration-500"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Past Event Videos */}
      <PastVideosSection />

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
                Bring the Crew, Get <span className="gradient-text">Rewarded</span>
              </h2>
              <p className="text-gray-400 max-w-lg mx-auto mb-8">
                Share your link with friends. When they come through, you earn — drinks, upgrades, free entry. It's that simple.
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

function PastVideosSection() {
  const [teasers, setTeasers] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/media/teasers').then(r => r.json()).then(d => {
      if (d.success) setTeasers(d.data)
    })
  }, [])

  if (teasers.length === 0) return null

  return (
    <section className="py-20 border-t border-[#1a1a1a]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-purple-400 text-sm font-medium uppercase tracking-widest mb-2">Relive The Night</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white">Past Events</h2>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {teasers.map(t => (
            <a
              key={t.id}
              href={t.youtubeUrl ?? '#'}
              target={t.youtubeUrl ? '_blank' : undefined}
              rel="noopener noreferrer"
              className="group relative rounded-2xl overflow-hidden bg-[#111] border border-[#2a2a2a] hover:border-purple-500/40 transition-all"
            >
              <div className="relative aspect-video bg-black overflow-hidden">
                <video
                  src={t.url}
                  className="w-full h-full object-cover"
                  muted
                  loop
                  playsInline
                  onMouseEnter={e => (e.target as HTMLVideoElement).play()}
                  onMouseLeave={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0 }}
                />
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Play size={20} className="text-white ml-1" fill="white" />
                  </div>
                </div>
              </div>
              <div className="p-4">
                <p className="text-white font-semibold truncate group-hover:text-purple-300 transition-colors">{t.event?.name}</p>
                {t.caption && <p className="text-gray-500 text-sm truncate mt-0.5">{t.caption}</p>}
                {t.youtubeUrl && (
                  <p className="text-purple-400 text-xs mt-2 flex items-center gap-1">
                    <Play size={10} fill="currentColor" /> Watch full video on YouTube
                  </p>
                )}
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
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
          <Image
            src={event.posterImage}
            alt={event.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
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
