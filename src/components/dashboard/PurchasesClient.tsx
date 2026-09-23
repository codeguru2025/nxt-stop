'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Receipt, Wine, ShoppingBag, Armchair, Check, X } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

type Voucher = {
  id: string
  code: string
  status: 'unredeemed' | 'redeemed' | 'cancelled'
  redeemedAt: string | null
  orderId: string
  qrDataUrl: string | null
  product: {
    name: string
    category: string
    isTable: boolean
    capacityPerUnit: number | null
    event: { name: string; date: string; venue: string } | null
  }
}

type Order = {
  id: string
  orderNumber: string
  status: string
  total: number
  paymentMethod: string | null
  createdAt: string
  paidAt: string | null
  items: { name: string; quantity: number; price: number }[]
}

const ORDER_STATUS_STYLE: Record<string, string> = {
  paid: 'bg-green-500/10 text-green-400 border-green-500/20',
  failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  refunded: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
}

function voucherIcon(v: Voucher) {
  if (v.product.isTable) return Armchair
  if (v.product.category === 'merchandise') return ShoppingBag
  return Wine
}

export default function PurchasesClient() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/dashboard/purchases')
      .then(r => {
        if (r.status === 401) { router.push('/login?from=/dashboard/purchases'); return null }
        return r.json()
      })
      .then(d => {
        if (!d) return
        if (d.success) { setOrders(d.data.orders); setVouchers(d.data.vouchers) }
        else setError(d.error ?? 'Could not load your purchases')
      })
      .catch(() => setError('Network error — check connection'))
      .finally(() => setLoading(false))
  }, [router])

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="skeleton h-8 w-48 rounded mb-6" />
      <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-28 rounded-xl" />)}</div>
    </div>
  )

  const activeVouchers = vouchers.filter(v => v.status === 'unredeemed')
  const usedVouchers = vouchers.filter(v => v.status !== 'unredeemed')

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white mb-1">My Purchases</h1>
        <p className="text-gray-500 text-sm">Your drink vouchers, tables and merch, plus every order you&apos;ve made</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-6 text-sm text-red-400">{error}</div>
      )}

      {/* Vouchers ready to use */}
      <section className="mb-10">
        <h2 className="text-sm text-gray-400 font-semibold uppercase tracking-wider mb-3">
          Ready to use {activeVouchers.length > 0 && <span className="text-purple-400">({activeVouchers.length})</span>}
        </h2>
        {activeVouchers.length === 0 ? (
          <div className="card p-6 text-center text-sm text-gray-500">
            No vouchers to redeem.{' '}
            <Link href="/merch" className="text-purple-400 hover:text-purple-300">Pre-order drinks, tables or merch</Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {activeVouchers.map(v => {
              const Icon = voucherIcon(v)
              return (
                <div key={v.id} className="card p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={16} className="text-purple-400 shrink-0" />
                    <h3 className="font-bold text-white">{v.product.name}</h3>
                  </div>
                  {v.product.isTable && v.product.capacityPerUnit && (
                    <p className="text-xs text-gray-400 mb-1">Seats {v.product.capacityPerUnit}</p>
                  )}
                  {v.product.event && (
                    <p className="text-xs text-gray-500 mb-3">
                      {v.product.event.name} · {formatDate(v.product.event.date, 'EEE d MMM')}
                    </p>
                  )}
                  {v.qrDataUrl && (
                    <div className="bg-white rounded-xl p-3 w-fit mx-auto">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={v.qrDataUrl} alt={`QR code for ${v.product.name}`} className="w-40 h-40" />
                    </div>
                  )}
                  <p className="text-center text-xs text-gray-500 font-mono mt-2">{v.code}</p>
                  <p className="text-center text-xs text-gray-600 mt-1">Show this QR at the bar or gate to redeem</p>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Order history */}
      <section className="mb-10">
        <h2 className="text-sm text-gray-400 font-semibold uppercase tracking-wider mb-3">Order history</h2>
        {orders.length === 0 ? (
          <div className="card p-6 text-center text-sm text-gray-500">
            No orders yet. <Link href="/events" className="text-purple-400 hover:text-purple-300">Browse events</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(o => (
              <div key={o.id} className="card p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Receipt size={14} className="text-gray-500 shrink-0" />
                    <span className="text-xs text-gray-400 font-mono truncate">{o.orderNumber}</span>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border capitalize shrink-0 ${ORDER_STATUS_STYLE[o.status] ?? 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                    {o.status}
                  </span>
                </div>
                <ul className="text-sm text-gray-300 space-y-0.5 mb-2">
                  {o.items.map((it, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span className="truncate">{it.quantity} × {it.name}</span>
                      <span className="text-gray-500 shrink-0">{formatCurrency(it.price * it.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between text-xs text-gray-500 border-t border-[#2a2a2a] pt-2">
                  <span>
                    {formatDate(o.paidAt ?? o.createdAt, 'd MMM yyyy, h:mm a')}
                    {o.paymentMethod && <span className="capitalize"> · {o.paymentMethod}</span>}
                  </span>
                  <span className="text-white font-bold">{formatCurrency(o.total)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Redeemed / cancelled vouchers */}
      {usedVouchers.length > 0 && (
        <section>
          <h2 className="text-sm text-gray-400 font-semibold uppercase tracking-wider mb-3">Used vouchers</h2>
          <div className="space-y-2">
            {usedVouchers.map(v => (
              <div key={v.id} className="card p-3 flex items-center justify-between gap-3 opacity-70">
                <div className="min-w-0">
                  <div className="text-sm text-white truncate">{v.product.name}</div>
                  <div className="text-xs text-gray-600 font-mono">{v.code}</div>
                </div>
                <span className="text-xs text-gray-400 flex items-center gap-1 shrink-0">
                  {v.status === 'redeemed' ? <Check size={12} /> : <X size={12} />}
                  {v.status === 'redeemed' && v.redeemedAt
                    ? `Redeemed ${formatDate(v.redeemedAt, 'd MMM, h:mm a')}`
                    : v.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
