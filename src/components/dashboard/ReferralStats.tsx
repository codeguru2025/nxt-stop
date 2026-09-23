'use client'

import { useEffect, useState } from 'react'
import { MousePointerClick, Users, ShoppingBag, Ticket, Percent, BarChart3, Loader2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

type Stats = {
  days: number
  empty?: boolean
  clicks: number
  peopleClicked: number
  peopleReached: number
  pagesViewed: number
  purchases: number
  buyers: number
  ticketsSold: number
  salesValue: number
  conversionRate: number
  allTime: { purchases: number; salesValue: number }
  earnings: { referralPending: number; referralPaid: number; partnerCommission: number | null }
  sources: { source: string; clicks: number }[]
  devices: { device: string; visits: number }[]
  topPages: { page: string; views: number }[]
  perEvent: { name: string; tickets: number; orders: number }[]
  daily: { day: string; clicks: number; purchases: number }[]
}

// Validated on the dark chart surface (#111): lightness band, chroma, CVD, contrast all pass
const CLICKS = '#a855f7'
const PURCHASES = '#16a34a'

const SOURCE_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp', facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', snapchat: 'Snapchat',
  'x (twitter)': 'X (Twitter)', google: 'Google', search: 'Other search', telegram: 'Telegram',
  direct: 'Opened directly / copied link', unknown: 'Unknown',
}
const DEVICE_LABEL: Record<string, string> = { mobile: 'Phone', tablet: 'Tablet', desktop: 'Computer', unknown: 'Unknown' }

function Tile({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value: string; hint?: string }) {
  return (
    <div className="stat-card">
      <Icon size={16} className="text-purple-400 mb-2" />
      <div className="text-2xl font-black text-white tabular-nums">{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
      {hint && <div className="text-[11px] text-gray-600 mt-0.5">{hint}</div>}
    </div>
  )
}

/** One series of daily columns. Single series → titled, no legend. Hover shows the day's value. */
function DailyColumns({ title, color, values, days }: { title: string; color: string; values: number[]; days: string[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...values)
  const niceMax = max <= 4 ? max : Math.ceil(max / 5) * 5
  const total = values.reduce((a, b) => a + b, 0)
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-200">{title}</h4>
        <span className="text-xs text-gray-500 tabular-nums">
          {hover !== null ? `${formatDate(days[hover], 'EEE d MMM')}: ${values[hover]}` : `${total} in total`}
        </span>
      </div>
      <div className="relative h-28 flex gap-[2px] items-end border-b border-[#2a2a2a]" onMouseLeave={() => setHover(null)}>
        <span className="absolute -top-1 left-0 text-[10px] text-gray-600 tabular-nums">{niceMax}</span>
        {values.map((v, i) => (
          // Hit target is the full column slot, bigger than the bar itself
          <div
            key={days[i]}
            className="flex-1 h-full flex items-end justify-center cursor-default"
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            tabIndex={0}
            aria-label={`${formatDate(days[i], 'EEE d MMM')}: ${v} ${title.toLowerCase()}`}
          >
            <div
              className="w-full max-w-[24px] rounded-t-[4px] transition-opacity"
              style={{
                height: v > 0 ? `${Math.max(3, (v / niceMax) * 100)}%` : 0,
                background: color,
                opacity: hover === null || hover === i ? 1 : 0.45,
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-gray-600 mt-1">
        <span>{formatDate(days[0], 'd MMM')}</span>
        <span>{formatDate(days[days.length - 1], 'd MMM')}</span>
      </div>
    </div>
  )
}

/** Ranked horizontal bars (single series) with the value at the tip. */
function RankedBars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map(r => r.value))
  if (rows.length === 0) return <p className="text-xs text-gray-600">No data yet</p>
  return (
    <ul className="space-y-2">
      {rows.map(r => (
        <li key={r.label} className="text-xs" title={`${r.label}: ${r.value}`}>
          <div className="flex justify-between text-gray-300 mb-1">
            <span className="truncate pr-2">{r.label}</span>
            <span className="tabular-nums text-gray-400">{r.value}</span>
          </div>
          <div className="h-2 rounded-r-[4px]" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: CLICKS }} />
        </li>
      ))}
    </ul>
  )
}

export default function ReferralStats() {
  const [days, setDays] = useState(30)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  // loading is switched on by the range buttons, so the effect only fetches
  useEffect(() => {
    fetch(`/api/dashboard/referral-stats?days=${days}`)
      .then(r => r.json())
      .then(d => { if (d.success) setStats(d.data) })
      .finally(() => setLoading(false))
  }, [days])

  if (!stats && loading) return <div className="skeleton h-72 rounded-2xl mb-6" />
  if (!stats || stats.empty) return null

  const dayLabels = stats.daily.map(d => d.day)
  return (
    <section className="card p-5 mb-6" aria-labelledby="link-performance">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 id="link-performance" className="font-bold text-white flex items-center gap-2">
          <BarChart3 size={18} className="text-purple-400" />
          How your link is doing
        </h3>
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

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <Tile icon={MousePointerClick} label="Link clicks" value={stats.clicks.toLocaleString()} hint={`${stats.peopleClicked.toLocaleString()} different people`} />
        <Tile icon={Users} label="People reached" value={stats.peopleReached.toLocaleString()} hint={`viewed ${stats.pagesViewed.toLocaleString()} pages`} />
        <Tile icon={ShoppingBag} label="Purchases" value={stats.purchases.toLocaleString()} hint={`by ${stats.buyers} ${stats.buyers === 1 ? 'person' : 'people'}`} />
        <Tile icon={Ticket} label="Tickets sold" value={stats.ticketsSold.toLocaleString()} hint={`${formatCurrency(stats.salesValue)} in sales`} />
        <Tile icon={Percent} label="Bought after visiting" value={`${stats.conversionRate}%`} hint="of people you reached" />
        <Tile
          icon={ShoppingBag}
          label="All-time sales via you"
          value={formatCurrency(stats.allTime.salesValue)}
          hint={`${stats.allTime.purchases} purchases`}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-6 mb-6">
        <DailyColumns title="Clicks per day" color={CLICKS} values={stats.daily.map(d => d.clicks)} days={dayLabels} />
        <DailyColumns title="Purchases per day" color={PURCHASES} values={stats.daily.map(d => d.purchases)} days={dayLabels} />
      </div>

      <div className="grid sm:grid-cols-3 gap-6 mb-4">
        <div>
          <h4 className="text-sm font-semibold text-gray-200 mb-2">Where clicks came from</h4>
          <RankedBars rows={stats.sources.map(s => ({ label: SOURCE_LABEL[s.source] ?? s.source, value: s.clicks }))} />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-gray-200 mb-2">What they looked at</h4>
          <RankedBars rows={stats.topPages.map(p => ({ label: p.page, value: p.views }))} />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-gray-200 mb-2">Devices</h4>
          <RankedBars rows={stats.devices.map(d => ({ label: DEVICE_LABEL[d.device] ?? d.device, value: d.visits }))} />
        </div>
      </div>

      {stats.perEvent.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-200 mb-2">Tickets sold through you, by event</h4>
          <ul className="text-sm divide-y divide-[#2a2a2a]">
            {stats.perEvent.map(e => (
              <li key={e.name} className="flex justify-between py-1.5">
                <span className="text-gray-300 truncate pr-3">{e.name}</span>
                <span className="text-gray-400 tabular-nums shrink-0">{e.tickets} tickets · {e.orders} orders</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="text-xs text-gray-500">
        <summary className="cursor-pointer hover:text-gray-300">Show daily numbers as a table</summary>
        <table className="w-full mt-2 tabular-nums">
          <thead><tr className="text-left text-gray-500"><th className="py-1 font-medium">Day</th><th className="font-medium">Clicks</th><th className="font-medium">Purchases</th></tr></thead>
          <tbody>
            {[...stats.daily].reverse().map(d => (
              <tr key={d.day} className="border-t border-[#1f1f1f] text-gray-400">
                <td className="py-1">{formatDate(d.day, 'EEE d MMM')}</td><td>{d.clicks}</td><td>{d.purchases}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <p className="text-[11px] text-gray-600 mt-3">
        A purchase counts as yours if the buyer clicked your link within the 30 days before buying. Clicks from
        WhatsApp/Facebook link previews aren’t counted — only real people. Visit details are kept for 90 days.
      </p>
    </section>
  )
}
