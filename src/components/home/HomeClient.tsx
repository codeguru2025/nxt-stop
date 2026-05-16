'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Calendar, MapPin, ArrowRight, Play } from 'lucide-react'
import { formatDate, formatCurrency, getEventTimePhase } from '@/lib/utils'
import PastVideosClient, { type TeaserItem } from '@/components/videos/PastVideosClient'

type LineupArtist = {
  name: string
  role: 'headline' | 'mc' | 'support_dj' | 'special_guest'
  image?: string
}

type Event = {
  id: string
  name: string
  slug: string
  date: string
  endDate?: string
  venue: string
  address?: string
  description?: string
  posterImage?: string
  status: string
  lineup?: string
  ticketTypes: { name: string; price: number; sold: number; capacity?: number }[]
  _count: { tickets: number }
}

function Countdown({ date }: { date: string }) {
  const [time, setTime] = useState({ d: 0, h: 0, m: 0, s: 0 })
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const tick = () => {
      const diff = new Date(date).getTime() - Date.now()
      if (diff <= 0) {
        setStarted(true)
        return
      }
      setStarted(false)
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

  if (started) {
    return <p className="text-sm text-gray-500">This event has started or passed.</p>
  }

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

type HomeProps = { initialEvents: Event[]; initialTeasers: TeaserItem[] }

export default function HomeClient({ initialEvents, initialTeasers }: HomeProps) {
  const events = initialEvents
  const [featuredImgError, setFeaturedImgError] = useState(false)

  const sortedEvents = useMemo(() => {
    const rank = { upcoming: 0, live: 1, ended: 2 } as const
    return [...events].sort((a, b) => {
      const pa = getEventTimePhase(a.date, a.endDate)
      const pb = getEventTimePhase(b.date, b.endDate)
      if (rank[pa] !== rank[pb]) return rank[pa] - rank[pb]
      return new Date(a.date).getTime() - new Date(b.date).getTime()
    })
  }, [events])

  const featured = sortedEvents.find(e => getEventTimePhase(e.date, e.endDate) !== 'ended') ?? sortedEvents[0]
  const gridEvents = sortedEvents

  return (
    <>
      {/* Hero */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <Image
            src="https://nxtstop-uploads.lon1.cdn.digitaloceanspaces.com/BigQ%20on%20deck.jpeg"
            alt=""
            fill
            priority
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/60 to-[#E8174A]/20" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/15 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#1A6B5A]/15 rounded-full blur-[120px]" />
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
                <div className="relative bg-gradient-to-br from-[#1a0a10] to-[#0d1a15] rounded-2xl border border-purple-500/20 overflow-hidden glow-purple">
                  <div className="relative h-48 bg-gradient-to-br from-purple-900/40 to-[#1A6B5A]/20">
                    {featured.posterImage && !featuredImgError ? (
                      <Image
                        src={featured.posterImage}
                        alt={featured.name}
                        fill
                        priority
                        className="object-cover"
                        onError={() => setFeaturedImgError(true)}
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
                      {(() => {
                        const ph = getEventTimePhase(featured.date, featured.endDate)
                        if (ph === 'live') {
                          return (
                            <>
                              <div className="w-2 h-2 rounded-full bg-red-400 pulse-glow" />
                              <span className="text-red-400 text-xs font-medium uppercase tracking-wider">Live now</span>
                            </>
                          )
                        }
                        if (ph === 'upcoming') {
                          return (
                            <>
                              <div className="w-2 h-2 rounded-full bg-sky-400 pulse-glow" />
                              <span className="text-sky-400 text-xs font-medium uppercase tracking-wider">Coming soon</span>
                            </>
                          )
                        }
                        return (
                          <>
                            <div className="w-2 h-2 rounded-full bg-zinc-500" />
                            <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Ended</span>
                          </>
                        )
                      })()}
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
                          {formatCurrency(featured.ticketTypes.length > 0 ? Math.min(...featured.ticketTypes.map(t => t.price)) : 0)}
                        </div>
                      </div>
                      <Link
                        href={`/events/${featured.slug}`}
                        className={`rounded-xl px-6 py-3 font-bold transition-all ${
                          getEventTimePhase(featured.date, featured.endDate) === 'ended'
                            ? 'bg-zinc-700 text-white hover:bg-zinc-600'
                            : 'bg-purple-600 hover:bg-purple-500 text-white hover:shadow-lg hover:shadow-purple-500/25'
                        }`}
                      >
                        {getEventTimePhase(featured.date, featured.endDate) === 'ended' ? 'View event' : 'Buy Ticket'}
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
      {featured && <SpotlightSection event={featured} />}

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

          {events.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">🎵</div>
              <p className="text-gray-500">No upcoming events — check back soon.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {gridEvents.map(event => (
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
              'https://nxtstop-uploads.lon1.cdn.digitaloceanspaces.com/Corrason.jpeg',
              'https://nxtstop-uploads.lon1.cdn.digitaloceanspaces.com/Corrason%202.jpeg',
              'https://nxtstop-uploads.lon1.cdn.digitaloceanspaces.com/Big%20Q%202.jpeg',
              'https://nxtstop-uploads.lon1.cdn.digitaloceanspaces.com/Corrason%203.jpeg',
              'https://nxtstop-uploads.lon1.cdn.digitaloceanspaces.com/Yugoe%20main.JPEG',
              'https://nxtstop-uploads.lon1.cdn.digitaloceanspaces.com/Big%20Q%206.jpeg',
              'https://nxtstop-uploads.lon1.cdn.digitaloceanspaces.com/Corrason%205.jpeg',
              'https://nxtstop-uploads.lon1.cdn.digitaloceanspaces.com/Yugo%203.jpeg',
              'https://nxtstop-uploads.lon1.cdn.digitaloceanspaces.com/Big%20Q%207.jpeg',
              'https://nxtstop-uploads.lon1.cdn.digitaloceanspaces.com/BigQ%20on%20deck.jpeg',
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
      <PastVideosClient mode="home" initialTeasers={initialTeasers} />

      {/* Referral CTA */}
      <section className="py-20 border-t border-[#1a1a1a]">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="relative bg-gradient-to-br from-purple-900/20 to-[#1A6B5A]/10 rounded-2xl border border-purple-500/20 p-12 overflow-hidden">
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

function SpotlightSection({ event }: { event: Event }) {
  const lineup: LineupArtist[] = (() => {
    try { return event.lineup ? JSON.parse(event.lineup) : [] } catch { return [] }
  })()

  const headline = lineup.find(a => a.role === 'headline')
  const mc = lineup.find(a => a.role === 'mc')
  const allArtists = lineup.map(a => a.name)

  const [headlineErr, setHeadlineErr] = useState(false)
  const [mcErr, setMcErr] = useState(false)
  const [posterErr, setPosterErr] = useState(false)

  const spotPhase = getEventTimePhase(event.date, event.endDate)

  return (
    <section className="py-20 border-t border-[#1a1a1a] bg-gradient-to-b from-[#0a0a0a] to-[#0a100e]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-1.5 mb-8">
          <div className={`w-2 h-2 rounded-full shrink-0 ${spotPhase === 'live' ? 'bg-red-400 pulse-glow' : spotPhase === 'upcoming' ? 'bg-sky-400 pulse-glow' : 'bg-zinc-500'}`} />
          <span className="text-purple-300 text-sm font-medium">
            {spotPhase === 'live' ? 'Live — ' : spotPhase === 'ended' ? 'Past event — ' : 'Next up — '}
            {formatDate(event.date, 'MMMM d, yyyy')}
          </span>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 items-center">
          {/* Artists / Poster */}
          <div className="relative">
            {(headline || mc) ? (
              <div className="grid grid-cols-5 gap-3 items-end">
                {/* Headline — large */}
                {headline ? (
                  <div className={`${mc ? 'col-span-3' : 'col-span-5'} relative rounded-2xl overflow-hidden aspect-[3/4] bg-[#1a1a1a]`}>
                    {headline.image && !headlineErr ? (
                      <Image
                        src={headline.image}
                        alt={headline.name}
                        fill
                        priority
                        className="object-cover"
                        onError={() => setHeadlineErr(true)}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl">🎵</div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-4">
                      <p className="text-white/60 text-xs uppercase tracking-widest mb-1">Headline Act</p>
                      <p className="text-white font-black text-xl leading-tight">{headline.name}</p>
                    </div>
                  </div>
                ) : null}
                {/* MC — smaller */}
                {mc ? (
                  <div className={`${headline ? 'col-span-2' : 'col-span-5'} relative rounded-2xl overflow-hidden aspect-[3/4] bg-[#1a1a1a]`}>
                    {mc.image && !mcErr ? (
                      <Image
                        src={mc.image}
                        alt={mc.name}
                        fill
                        priority
                        className="object-cover"
                        onError={() => setMcErr(true)}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl">🎤</div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-3">
                      <p className="text-purple-400 text-xs font-medium uppercase tracking-wider mb-1">MC</p>
                      <p className="text-white font-black text-lg leading-tight">{mc.name}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : event.posterImage && !posterErr ? (
              <div className="relative rounded-2xl overflow-hidden aspect-[3/4] bg-[#1a1a1a]">
                <Image
                  src={event.posterImage}
                  alt={event.name}
                  fill
                  priority
                  className="object-cover"
                  onError={() => setPosterErr(true)}
                />
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden aspect-[3/4] bg-[#1a1a1a] flex items-center justify-center text-7xl">
                🎵
              </div>
            )}
          </div>

          {/* Details */}
          <div className="lg:pl-6 pt-4 lg:pt-0">
            <h2 className="text-4xl sm:text-5xl font-black text-white leading-none mb-2">NXT STOP</h2>
            <h3 className="text-2xl sm:text-3xl font-black gradient-text mb-6">{event.name}</h3>

            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3">
                <span className="text-xl">📍</span>
                <div>
                  <span className="text-gray-500 text-xs uppercase tracking-wider">Venue</span>
                  <p className="text-white font-semibold">{event.venue}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xl">📅</span>
                <div>
                  <span className="text-gray-500 text-xs uppercase tracking-wider">Date</span>
                  <p className="text-white font-semibold">{formatDate(event.date, 'EEEE, d MMMM yyyy')}</p>
                </div>
              </div>
            </div>

            {allArtists.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-8">
                {allArtists.map(a => (
                  <span key={a} className="bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm font-medium px-3 py-1 rounded-full">
                    {a}
                  </span>
                ))}
              </div>
            )}

            <Link
              href={`/events/${event.slug}`}
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl px-8 py-4 font-bold text-lg transition-all hover:shadow-lg hover:shadow-purple-500/25 hover:-translate-y-0.5"
            >
              Get Tickets
              <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function EventCard({ event }: { event: Event }) {
  const [imgError, setImgError] = useState(false)
  const prices = event.ticketTypes?.map(t => t.price) ?? []
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0
  const phase = getEventTimePhase(event.date, event.endDate)

  return (
    <Link
      href={`/events/${event.slug}`}
      className={`group card overflow-hidden hover:border-[#3a3a3a] transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-black/50 ${phase === 'ended' ? 'opacity-75' : ''}`}
    >
      {/* Image */}
      <div className="relative h-48 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] overflow-hidden">
        {event.posterImage && !imgError ? (
          <Image
            src={event.posterImage}
            alt={event.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-5xl">🎵</div>
          </div>
        )}
        {phase === 'live' && (
          <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wide pulse-glow">
            Live now
          </div>
        )}
        {phase === 'upcoming' && (
          <div className="absolute top-3 left-3 bg-sky-600 text-white text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wide">
            Coming soon
          </div>
        )}
        {phase === 'ended' && (
          <div className="absolute top-3 left-3 bg-zinc-600 text-white text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wide">
            Ended
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
          <span className="text-xs text-gray-600">{event.ticketTypes.reduce((s, t) => s + t.sold, 0)} sold</span>
          <span className="text-sm font-semibold text-purple-400 group-hover:text-purple-300 transition-colors flex items-center gap-1">
            {phase === 'ended' ? 'View' : 'Buy Ticket'} <ArrowRight size={13} />
          </span>
        </div>
      </div>
    </Link>
  )
}
