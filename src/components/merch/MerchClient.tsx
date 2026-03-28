'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ShoppingBag, Filter, ChevronLeft } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

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

export default function MerchClient() {
  const [items, setItems] = useState<MerchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')

  useEffect(() => {
    fetch('/api/merch')
      .then(r => r.json())
      .then(d => { if (d.success) setItems(d.data) })
      .finally(() => setLoading(false))
  }, [])

  const types = Array.from(new Set(items.map(i => i.merchType).filter(Boolean))) as string[]
  const displayed = typeFilter ? items.filter(i => i.merchType === typeFilter) : items

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Nav */}
      <div className="border-b border-[#1a1a1a] px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
          <ChevronLeft size={16} /> Back
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center">
            <span className="text-white font-black text-xs">N</span>
          </div>
          <span className="font-black text-white text-sm">NXT STOP</span>
        </div>
        <div className="w-16" />
      </div>

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
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-64 rounded-2xl" />)}
          </div>
        ) : displayed.length === 0 ? (
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
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer CTA */}
        {displayed.length > 0 && (
          <div className="mt-14 text-center bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-500/20 rounded-2xl p-8">
            <p className="text-white font-bold text-lg mb-2">Pick yours up at the event 🎉</p>
            <p className="text-gray-400 text-sm mb-4">Merchandise is available for purchase at the venue. Get your ticket first.</p>
            <Link href="/" className="btn-primary text-sm inline-flex items-center gap-2">
              Browse Events →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
