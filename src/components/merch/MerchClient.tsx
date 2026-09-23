'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ShoppingBag, Filter } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import MerchBuyModal from './MerchBuyModal'

type MerchItem = {
  id: string
  name: string
  price: number
  stock: number
  sold: number
  merchType?: string | null
  size?: string | null
  color?: string | null
  description?: string | null
  image?: string | null
  event: { id: string; name: string; date: string; slug: string }
}

const MERCH_LABELS: Record<string, string> = {
  tshirt: 'T-Shirt', hoodie: 'Hoodie', cap: 'Cap',
  wineglass: 'Wine Glass', tote: 'Tote Bag', vinyl: 'Vinyl / CD',
  poster: 'Poster', wristband: 'Wristband', other: 'Other',
}

const TYPE_ICONS: Record<string, string> = {
  tshirt: '👕', hoodie: '🧥', cap: '🧢',
  wineglass: '🍷', tote: '👜', vinyl: '💿',
  poster: '🖼️', wristband: '📿', other: '🛍️',
}

type ExtraItem = {
  id: string; name: string; price: number; stock: number; sold: number
  category: string; isTable: boolean; capacityPerUnit: number | null
  description?: string | null; image?: string | null
  event: { id: string; name: string; date: string; slug: string }
}

const CATEGORY_ICONS: Record<string, string> = { drink: '🍹', food: '🍔', table: '🍾', other: '🎟️' }
const CATEGORY_LABELS: Record<string, string> = { drink: 'Drink Voucher', food: 'Food Voucher', table: 'Table Booking', other: 'Extra' }

type Props = { initialItems: MerchItem[]; extras?: ExtraItem[] }

export default function MerchClient({ initialItems, extras = [] }: Props) {
  const items = initialItems
  const [typeFilter, setTypeFilter] = useState('')
  const [buying, setBuying] = useState<MerchItem | ExtraItem | null>(null)

  const types = Array.from(new Set(items.map(i => i.merchType).filter(Boolean))) as string[]
  const displayed = typeFilter ? items.filter(i => i.merchType === typeFilter) : items

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-1.5 text-purple-300 text-xs font-semibold uppercase tracking-widest mb-4">
            <ShoppingBag size={12} /> Official Merch
          </div>
          <h1 className="text-4xl font-black text-white mb-2">NXT STOP Merch</h1>
          <p className="text-gray-400 text-sm">Represent the movement. Available at our events.</p>
        </div>

        {/* Type filter */}
        {types.length > 1 && (
          <div className="flex flex-wrap gap-2 justify-center mb-8">
            <button
              onClick={() => setTypeFilter('')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${!typeFilter ? 'bg-purple-600 text-white' : 'bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 hover:text-white'}`}
            >
              All
            </button>
            {types.map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(typeFilter === t ? '' : t)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${typeFilter === t ? 'bg-purple-600 text-white' : 'bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 hover:text-white'}`}
              >
                {TYPE_ICONS[t] ?? '🛍️'} {MERCH_LABELS[t] ?? t}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        {displayed.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🛍️</div>
            <h2 className="text-xl font-bold text-white mb-2">Merch coming soon</h2>
            <p className="text-gray-500 text-sm">Check back closer to the event for the latest drops.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayed.map(item => {
              const typeLabel = MERCH_LABELS[item.merchType ?? ''] ?? item.merchType ?? 'Merchandise'
              const typeIcon  = TYPE_ICONS[item.merchType ?? ''] ?? '🛍️'
              const outOfStock = item.stock === 0

              return (
                <div key={item.id} className={`bg-[#111] border border-[#1e1e1e] rounded-2xl overflow-hidden transition-all hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/5 ${outOfStock ? 'opacity-60' : ''}`}>
                  {/* Image or placeholder */}
                  <div className="aspect-square bg-gradient-to-br from-[#1a1a1a] to-[#111] flex items-center justify-center relative overflow-hidden">
                    {item.image ? (
                      <Image src={item.image} alt={item.name} fill className="object-cover" />
                    ) : (
                      <span className="text-6xl">{typeIcon}</span>
                    )}
                    {outOfStock && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-white font-black text-sm bg-red-500/80 px-3 py-1 rounded-full">Sold Out</span>
                      </div>
                    )}
                    {!outOfStock && item.stock <= 5 && (
                      <div className="absolute top-3 right-3 bg-orange-500/90 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        Only {item.stock} left
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <p className="font-bold text-white">{item.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {typeIcon} {typeLabel}
                          {item.size && item.size !== 'One Size' && <span className="ml-1.5 bg-[#1a1a1a] border border-[#2a2a2a] px-1.5 py-0.5 rounded text-gray-400">{item.size}</span>}
                        </p>
                      </div>
                      <span className="text-white font-black text-lg">{formatCurrency(item.price)}</span>
                    </div>

                    {item.description && (
                      <p className="text-xs text-gray-500 mt-2 leading-relaxed">{item.description}</p>
                    )}

                    <div className="mt-3 pt-3 border-t border-[#1e1e1e] flex items-center justify-between">
                      <Link
                        href={`/events/${item.event.slug}`}
                        className="text-xs text-gray-500 hover:text-purple-400 transition-colors"
                      >
                        @ {item.event.name}
                      </Link>
                      <span className="text-xs text-gray-600">{item.sold} sold</span>
                    </div>

                    {!outOfStock && (
                      <button
                        onClick={() => setBuying(item)}
                        className="btn-primary w-full text-sm mt-3"
                      >
                        Buy Now — Pick Up at Event
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pre-event extras: drink vouchers, tables */}
        {extras.length > 0 && (
          <div className="mt-14">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black text-white mb-1">Pre-Event Extras</h2>
              <p className="text-gray-400 text-sm">Drink vouchers &amp; table bookings — pay now, redeem at the door.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {extras.map(item => {
                const outOfStock = item.stock === 0
                const icon = CATEGORY_ICONS[item.category] ?? '🎟️'
                const label = item.isTable ? `Table (${item.capacityPerUnit ?? '?'} seats)` : (CATEGORY_LABELS[item.category] ?? item.category)
                return (
                  <div key={item.id} className={`bg-[#111] border border-[#1e1e1e] rounded-2xl overflow-hidden p-4 ${outOfStock ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <p className="font-bold text-white">{icon} {item.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                      </div>
                      <span className="text-white font-black text-lg">{formatCurrency(item.price)}</span>
                    </div>
                    {item.description && <p className="text-xs text-gray-500 mt-2">{item.description}</p>}
                    <Link href={`/events/${item.event.slug}`} className="text-xs text-gray-500 hover:text-purple-400 transition-colors block mt-2">
                      @ {item.event.name}
                    </Link>
                    {outOfStock ? (
                      <span className="block text-center text-xs text-red-400 font-bold mt-3">Sold Out</span>
                    ) : (
                      <button onClick={() => setBuying(item)} className="btn-primary w-full text-sm mt-3">
                        Buy Now
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Footer CTA */}
        {displayed.length > 0 && (
          <div className="mt-14 text-center bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-500/20 rounded-2xl p-8">
            <p className="text-white font-bold text-lg mb-2">Buy now, collect at the event 🎉</p>
            <p className="text-gray-400 text-sm mb-4">Pay ahead of time and redeem your code at the venue.</p>
            <Link href="/" className="btn-primary text-sm inline-flex items-center gap-2">
              Browse Events →
            </Link>
          </div>
        )}
      </div>

      {buying && <MerchBuyModal item={buying} onClose={() => setBuying(null)} />}
    </div>
  )
}
