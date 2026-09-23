'use client'

import { useEffect, useMemo, useState } from 'react'
import { Trophy, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

type Link = {
  code: string
  clicks: number
  people: number
  purchases: number
  buyers: number
  tickets: number
  sales: number
  conversionRate: number | null
  owner: { name: string; phone: string; kind: 'Customer' | 'Partner'; detail: string | null }
}
type SortKey = 'sales' | 'clicks' | 'people' | 'tickets' | 'conversionRate'

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'clicks', label: 'Clicks' },
  { key: 'people', label: 'People reached' },
  { key: 'tickets', label: 'Tickets' },
  { key: 'sales', label: 'Sales' },
  { key: 'conversionRate', label: '% bought' },
]

/** Every referral link ranked — who actually drives sales. Admin Referrals page. */
export default function ReferralLeaderboard() {
  const [days, setDays] = useState(30)
  const [links, setLinks] = useState<Link[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortKey>('sales')

  // loading is switched on by the range buttons, so the effect only fetches
  useEffect(() => {
    fetch(`/api/admin/referral-leaderboard?days=${days}`)
      .then(r => r.json())
      .then(d => { if (d.success) setLinks(d.data.links) })
      .finally(() => setLoading(false))
  }, [days])

  const sorted = useMemo(
    () => [...(links ?? [])].sort((a, b) => (b[sort] ?? -1) - (a[sort] ?? -1) || b.sales - a.sales),
    [links, sort]
  )
  const totals = useMemo(() => (links ?? []).reduce(
    (t, l) => ({ clicks: t.clicks + l.clicks, tickets: t.tickets + l.tickets, sales: t.sales + l.sales }),
    { clicks: 0, tickets: 0, sales: 0 }
  ), [links])

  return (
    <section className="card p-5 mb-8" aria-labelledby="leaderboard">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 id="leaderboard" className="font-bold text-white flex items-center gap-2">
          <Trophy size={18} className="text-yellow-400" />
          Referral link leaderboard
        </h2>
        <div className="flex gap-1 items-center" role="group" aria-label="Time range">
          {loading && <Loader2 size={14} className="animate-spin text-gray-500 mr-1" />}
          {[7, 30, 90].map(n => (
            <button
              key={n}
              onClick={() => { if (n !== days) { setLoading(true); setDays(n) } }}
              className={`text-xs px-2.5 py-1 rounded-md border ${days === n ? 'bg-purple-500/15 border-purple-500/30 text-purple-200' : 'border-[#2a2a2a] text-gray-500 hover:text-white'}`}
            >
              {n} days
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Customers and partners whose links brought people to the site or made sales in the last {days} days.
        {links && links.length > 0 && <> Together: {totals.clicks.toLocaleString()} clicks, {totals.tickets.toLocaleString()} tickets, {formatCurrency(totals.sales)}.</>}
      </p>

      {links === null ? (
        <div className="skeleton h-40 rounded-xl" />
      ) : sorted.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">No referral link activity in this period yet.</p>
      ) : (
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm tabular-nums min-w-[640px]">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-[#2a2a2a]">
                <th className="py-2 pr-2 font-medium w-8">#</th>
                <th className="py-2 pr-3 font-medium">Link owner</th>
                {COLUMNS.map(c => (
                  <th key={c.key} className="py-2 px-2 font-medium text-right">
                    <button
                      onClick={() => setSort(c.key)}
                      className={sort === c.key ? 'text-purple-300' : 'hover:text-gray-300'}
                      aria-pressed={sort === c.key}
                      title={`Rank by ${c.label.toLowerCase()}`}
                    >
                      {c.label}{sort === c.key ? ' ↓' : ''}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((l, i) => (
                <tr key={l.code} className="border-b border-[#1f1f1f] last:border-0">
                  <td className="py-2.5 pr-2 text-gray-500">{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td>
                  <td className="py-2.5 pr-3">
                    <div className="text-white font-medium">{l.owner.name}</div>
                    <div className="text-xs text-gray-500">
                      <span className={l.owner.kind === 'Partner' ? 'text-purple-300' : ''}>{l.owner.kind}</span>
                      {l.owner.detail && <> · {l.owner.detail}</>} · {l.owner.phone}
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-right text-gray-300">{l.clicks.toLocaleString()}</td>
                  <td className="py-2.5 px-2 text-right text-gray-300">{l.people.toLocaleString()}</td>
                  <td className="py-2.5 px-2 text-right text-gray-300">{l.tickets.toLocaleString()}</td>
                  <td className="py-2.5 px-2 text-right text-white font-semibold">{formatCurrency(l.sales)}</td>
                  <td className="py-2.5 px-2 text-right text-gray-300">{l.conversionRate === null ? '—' : `${l.conversionRate}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-gray-600 mt-3">
        Sales are credited when the buyer clicked the link within 30 days before buying. “% bought” = people who bought ÷
        people the link reached. Link-preview robots aren’t counted.
      </p>
    </section>
  )
}
