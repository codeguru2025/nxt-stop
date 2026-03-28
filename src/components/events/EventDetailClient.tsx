'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import {
  Calendar, MapPin, Clock, Users, Ticket, Share2,
  Check, AlertCircle, Loader2, Music, Video, Star, Phone, ExternalLink
} from 'lucide-react'
import { formatDate, formatCurrency, buildReferralUrl } from '@/lib/utils'

type TicketType = {
  id: string; name: string; description?: string; price: number
  capacity: number; sold: number; color: string
}

type Event = {
  id: string; name: string; slug: string; description?: string
  venue: string; address?: string; date: string; endDate?: string
  posterImage?: string; bannerImage?: string; videoUrl?: string
  lineup?: string; hasVirtual: boolean; virtualPrice: number
  platformFee: number; status: string; ticketTypes: TicketType[]
  media: { id: string; type: string; url: string; caption?: string }[]
  _count: { tickets: number; socialPosts: number }
}

const PAYMENT_METHODS = [
  { id: 'ecocash',  label: 'EcoCash',   icon: '📱', mobile: true },
  { id: 'onemoney', label: 'OneMoney',  icon: '💰', mobile: true },
  { id: 'innbucks', label: 'InnBucks',  icon: '🔵', mobile: true },
  { id: 'omari',    label: "O'mari",    icon: '🏦', mobile: true },
  { id: 'standard', label: 'Card / Bank', icon: '💳', mobile: false },
]

type Stage =
  | { name: 'idle' }
  | { name: 'phone' }
  | { name: 'processing' }
  | { name: 'mobile_pending'; instructions: string; orderId: string }
  | { name: 'innbucks_pending'; code: string; orderId: string }
  | { name: 'redirect'; redirectUrl: string; orderId: string }
  | { name: 'paid' }
  | { name: 'error'; message: string }

export default function EventDetailClient() {
  const { slug } = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState('ecocash')
  const [phone, setPhone] = useState('')
  const [stage, setStage] = useState<Stage>({ name: 'idle' })
  const [user, setUser] = useState<any>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const ref = searchParams.get('ref') ?? ''

  useEffect(() => {
    Promise.all([
      fetch(`/api/events/${slug}`).then(r => r.json()),
      fetch('/api/auth/me').then(r => r.json()),
    ]).then(([evRes, userRes]) => {
      if (evRes.success) {
        setEvent(evRes.data)
        if (evRes.data.ticketTypes[0]) setSelectedType(evRes.data.ticketTypes[0].id)
      }
      if (userRes.success) setUser(userRes.data)
    }).finally(() => setLoading(false))
  }, [slug])

  // Clean up polling on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const selectedTicket = event?.ticketTypes.find(t => t.id === selectedType)
  const available = selectedTicket ? selectedTicket.capacity - selectedTicket.sold : 0
  const subtotal = selectedTicket ? selectedTicket.price * quantity : 0
  const fees = quantity * (event?.platformFee ?? 0.10)
  const total = subtotal + fees

  const isMobile = PAYMENT_METHODS.find(m => m.id === paymentMethod)?.mobile ?? false

  function startPolling(orderId: string) {
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/paynow/poll?orderId=${orderId}`).then(r => r.json())
      if (res.success && res.data.status === 'paid') {
        clearInterval(pollRef.current!)
        setStage({ name: 'paid' })
        setTimeout(() => router.push('/dashboard/tickets'), 3000)
      }
    }, 5000)
  }

  const handleBuy = async () => {
    if (!user) { router.push(`/login?redirect=/events/${slug}`); return }
    if (!selectedType) return

    if (isMobile && stage.name === 'idle') {
      setStage({ name: 'phone' })
      return
    }

    setStage({ name: 'processing' })

    // 1. Create pending order
    const orderRes = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: event!.id,
        ticketTypeId: selectedType,
        quantity,
        referralCode: ref || undefined,
      }),
    }).then(r => r.json())

    if (!orderRes.success) {
      setStage({ name: 'error', message: orderRes.error ?? 'Could not create order.' })
      return
    }

    const orderId = orderRes.data.order.id

    // 2. Initiate Paynow payment
    const payRes = await fetch('/api/paynow/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, method: paymentMethod, phone: isMobile ? phone : undefined }),
    }).then(r => r.json())

    if (!payRes.success) {
      setStage({ name: 'error', message: payRes.error ?? 'Payment initiation failed.' })
      return
    }

    const result = payRes.data

    if (result.type === 'redirect') {
      setStage({ name: 'redirect', redirectUrl: result.redirectUrl, orderId })
      startPolling(orderId)
      window.location.href = result.redirectUrl
      return
    }

    if (result.type === 'innbucks') {
      setStage({ name: 'innbucks_pending', code: result.innbucksCode, orderId })
      startPolling(orderId)
      return
    }

    // mobile
    setStage({ name: 'mobile_pending', instructions: result.instructions, orderId })
    startPolling(orderId)
  }

  const lineup: string[] = event?.lineup ? JSON.parse(event.lineup) : []

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-purple-500" />
    </div>
  )

  if (!event) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4">😢</div>
        <p className="text-gray-400">Event not found.</p>
      </div>
    </div>
  )

  return (
    <div>
      {/* Hero Banner */}
      <div className="relative h-[50vh] min-h-[300px] overflow-hidden">
        {event.bannerImage || event.posterImage ? (
          <img src={event.bannerImage ?? event.posterImage!} alt={event.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-900/60 via-[#0a0a0a] to-pink-900/40 flex items-center justify-center">
            <div className="text-8xl">🎧</div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/50 to-transparent" />
        {event.status === 'live' && (
          <div className="absolute top-6 left-6 bg-red-500 text-white text-sm font-bold px-4 py-2 rounded-xl pulse-glow uppercase tracking-wide">
            🔴 LIVE NOW
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 -mt-16 relative">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main info */}
          <div className="lg:col-span-2">
            <h1 className="text-3xl sm:text-4xl font-black text-white mb-4">{event.name}</h1>

            <div className="flex flex-wrap gap-4 mb-6">
              <div className="flex items-center gap-2 text-gray-400">
                <Calendar size={16} className="text-purple-400" />
                <span>{formatDate(event.date, 'EEEE, MMMM d, yyyy')}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <Clock size={16} className="text-purple-400" />
                <span>{formatDate(event.date, 'h:mm a')} {event.endDate ? `– ${formatDate(event.endDate, 'h:mm a')}` : ''}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <MapPin size={16} className="text-purple-400" />
                <span>{event.venue}{event.address ? `, ${event.address}` : ''}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <Ticket size={16} className="text-purple-400" />
                <span>{event._count.tickets} tickets sold</span>
              </div>
            </div>

            <button
              onClick={() => navigator.share?.({ title: event.name, url: window.location.href } as any)}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-purple-400 transition-colors mb-8"
            >
              <Share2 size={14} />
              Share & Earn Rewards
            </button>

            {event.description && (
              <div className="mb-8">
                <h2 className="text-xl font-bold text-white mb-3">About This Event</h2>
                <p className="text-gray-400 leading-relaxed">{event.description}</p>
              </div>
            )}

            {lineup.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Music size={20} className="text-purple-400" />
                  Lineup
                </h2>
                <div className="flex flex-wrap gap-2">
                  {lineup.map((artist: string) => (
                    <div key={artist} className="flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2">
                      <Star size={14} className="text-yellow-400" />
                      <span className="font-medium text-white">{artist}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {event.hasVirtual && (
              <div className="mb-8 bg-[#1a1a2e] border border-blue-500/20 rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Video size={20} className="text-blue-400" />
                </div>
                <div>
                  <div className="font-semibold text-white">Virtual Attendance Available</div>
                  <div className="text-gray-400 text-sm">Watch the livestream from anywhere — {formatCurrency(event.virtualPrice)}</div>
                </div>
              </div>
            )}

            {event.media.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-bold text-white mb-4">Gallery</h2>
                <div className="grid grid-cols-3 gap-2">
                  {event.media.map(m => (
                    <div key={m.id} className="aspect-square rounded-xl overflow-hidden bg-[#1a1a1a]">
                      {m.type === 'image' ? (
                        <img src={m.url} alt={m.caption ?? ''} className="w-full h-full object-cover" />
                      ) : (
                        <video src={m.url} className="w-full h-full object-cover" muted />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Ticket purchase sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              {stage.name === 'paid' ? (
                <PaidCard />
              ) : stage.name === 'mobile_pending' ? (
                <MobilePendingCard instructions={stage.instructions} />
              ) : stage.name === 'innbucks_pending' ? (
                <InnbucksCard code={stage.code} />
              ) : stage.name === 'error' ? (
                <div className="card p-6">
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4 text-sm text-red-400">
                    <AlertCircle size={14} />
                    {stage.message}
                  </div>
                  <button
                    onClick={() => setStage({ name: 'idle' })}
                    className="w-full btn-primary"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <div className="card p-6">
                  <h3 className="text-xl font-bold text-white mb-5">Get Your Tickets</h3>

                  {/* Ticket type selection */}
                  <div className="space-y-2 mb-5">
                    {event.ticketTypes.map(t => {
                      const avail = t.capacity - t.sold
                      const isSelected = selectedType === t.id
                      return (
                        <button
                          key={t.id}
                          onClick={() => avail > 0 && setSelectedType(t.id)}
                          disabled={avail <= 0}
                          className={`w-full rounded-xl p-3.5 text-left transition-all border ${
                            isSelected
                              ? 'border-purple-500 bg-purple-500/10'
                              : avail <= 0
                              ? 'border-[#2a2a2a] opacity-40 cursor-not-allowed'
                              : 'border-[#2a2a2a] hover:border-[#3a3a3a]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                              <span className="font-semibold text-white">{t.name}</span>
                            </div>
                            <span className="font-black text-white">{formatCurrency(t.price)}</span>
                          </div>
                          {t.description && (
                            <p className="text-xs text-gray-500 mt-1 ml-4">{t.description}</p>
                          )}
                          <div className="flex items-center justify-between mt-1.5 ml-4">
                            <span className="text-xs text-gray-600">{avail} remaining</span>
                            {avail <= 20 && avail > 0 && <span className="text-xs text-orange-400 font-medium">Almost sold out!</span>}
                            {avail <= 0 && <span className="text-xs text-red-400 font-medium">Sold Out</span>}
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {/* Quantity */}
                  <div className="mb-5">
                    <label>Quantity</label>
                    <div className="flex items-center gap-3 mt-1">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="w-10 h-10 rounded-lg bg-[#2a2a2a] flex items-center justify-center text-white hover:bg-[#3a3a3a] transition-colors font-bold"
                      >−</button>
                      <span className="text-xl font-bold text-white w-8 text-center">{quantity}</span>
                      <button
                        onClick={() => setQuantity(Math.min(10, available, quantity + 1))}
                        disabled={quantity >= Math.min(10, available)}
                        className="w-10 h-10 rounded-lg bg-[#2a2a2a] flex items-center justify-center text-white hover:bg-[#3a3a3a] transition-colors font-bold disabled:opacity-40"
                      >+</button>
                    </div>
                  </div>

                  {/* Payment method */}
                  <div className="mb-5">
                    <label>Payment Method</label>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      {PAYMENT_METHODS.map(pm => (
                        <button
                          key={pm.id}
                          onClick={() => { setPaymentMethod(pm.id); setStage({ name: 'idle' }); setPhone('') }}
                          className={`rounded-lg p-2 text-center text-xs font-medium border transition-all ${
                            paymentMethod === pm.id
                              ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                              : 'border-[#2a2a2a] text-gray-400 hover:border-[#3a3a3a]'
                          }`}
                        >
                          <div className="text-lg mb-0.5">{pm.icon}</div>
                          {pm.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Phone input — shown when mobile method + phone stage */}
                  {stage.name === 'phone' && isMobile && (
                    <div className="mb-5">
                      <label>Mobile Number</label>
                      <div className="relative mt-1">
                        <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                          type="tel"
                          placeholder="07X XXX XXXX"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                  )}

                  {/* Price summary */}
                  {selectedTicket && (
                    <div className="bg-[#111] rounded-xl p-4 mb-5 space-y-2">
                      <div className="flex justify-between text-sm text-gray-400">
                        <span>{selectedTicket.name} × {quantity}</span>
                        <span>{formatCurrency(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Platform fee</span>
                        <span>{formatCurrency(fees)}</span>
                      </div>
                      <div className="border-t border-[#2a2a2a] pt-2 flex justify-between font-bold text-white">
                        <span>Total</span>
                        <span>{formatCurrency(total)}</span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleBuy}
                    disabled={stage.name === 'processing' || !selectedType || available <= 0 || (stage.name === 'phone' && !phone)}
                    className="w-full btn-primary flex items-center justify-center gap-2 text-base"
                  >
                    {stage.name === 'processing' ? (
                      <><Loader2 size={18} className="animate-spin" /> Processing...</>
                    ) : stage.name === 'phone' ? (
                      <><Phone size={18} /> Confirm &amp; Pay</>
                    ) : user ? (
                      <><Ticket size={18} /> Buy {quantity} Ticket{quantity > 1 ? 's' : ''}</>
                    ) : (
                      'Sign In to Buy'
                    )}
                  </button>

                  {ref && (
                    <p className="text-xs text-gray-600 mt-3 text-center">
                      Referred by a friend — they'll earn reward points when you buy!
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PaidCard() {
  return (
    <div className="card p-6 text-center border-green-500/30 bg-green-500/5">
      <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
        <Check size={32} className="text-green-400" />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">Tickets Purchased!</h3>
      <p className="text-gray-400 text-sm">Redirecting to your tickets...</p>
    </div>
  )
}

function MobilePendingCard({ instructions }: { instructions: string }) {
  return (
    <div className="card p-6 text-center border-yellow-500/30 bg-yellow-500/5">
      <Loader2 size={32} className="animate-spin text-yellow-400 mx-auto mb-4" />
      <h3 className="text-lg font-bold text-white mb-2">Check Your Phone</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{instructions}</p>
      <p className="text-gray-600 text-xs mt-4">This page will update automatically when payment is confirmed.</p>
    </div>
  )
}

function InnbucksCard({ code }: { code: string }) {
  const deepLink = `schinn.wbpycode://innbucks.co.zw?pymInnCode=${code}`
  return (
    <div className="card p-6 text-center border-blue-500/30 bg-blue-500/5">
      <div className="text-4xl mb-3">🔵</div>
      <h3 className="text-lg font-bold text-white mb-2">InnBucks Authorization</h3>
      <div className="bg-[#111] rounded-xl p-4 mb-4">
        <p className="text-xs text-gray-500 mb-1">Authorization Code</p>
        <p className="text-2xl font-black text-white tracking-widest">{code}</p>
      </div>
      <a href={deepLink} className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors mb-3">
        <ExternalLink size={14} /> Open InnBucks App
      </a>
      <p className="text-gray-600 text-xs">Enter the code in your InnBucks app to complete payment. This page updates automatically.</p>
    </div>
  )
}
