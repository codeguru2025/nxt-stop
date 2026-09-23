'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Eye, Users, CalendarDays, Link2, Smartphone, Monitor, Tablet } from 'lucide-react'
import { formatDate } from '@/lib/utils'

type Visit = {
  id: string
  createdAt: string
  path: string
  isReferralClick: boolean
  who: string
  role: string | null
  loggedIn: boolean
  viaLinkOf: string | null
  source: string | null
  device: string | null
}
type Summary = {
  viewsToday: number
  visitorsToday: number
  viewsThisWeek: number
  referralClicksToday: number
  topPages: { path: string; views: number }[]
}

// Plain names for pages; anything else shows its address
const PAGE_NAMES: Record<string, string> = {
  '/': 'Home page', '/events': 'All events', '/merch': 'Merch & pre-orders', '/gallery': 'Gallery', '/videos': 'Past videos',
  '/about': 'About', '/login': 'Login page', '/forgot-password': 'Forgot password', '/dashboard': 'Their dashboard',
  '/dashboard/tickets': 'Their tickets', '/dashboard/purchases': 'Their purchases', '/dashboard/referrals': 'Their referrals',
  '/dashboard/rewards': 'Rewards shop', '/dashboard/account': 'Their account settings', '/admin': 'Admin: overview',
  '/gate': 'Gate scanner', '/gate/activate': 'Sell printed tickets',
}
function pageName(path: string): string {
  if (PAGE_NAMES[path]) return PAGE_NAMES[path]
  if (path.startsWith('/r/')) return 'Clicked a referral link'
  if (path.startsWith('/events/')) return `Event page (${path.slice(8)})`
  if (path.startsWith('/admin/')) return `Admin: ${path.slice(7).replace(/-/g, ' ')}`
  return path
}
const SOURCE: Record<string, string> = { whatsapp: 'WhatsApp', facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', google: 'Google', direct: '' }
const DeviceIcon = ({ d }: { d: string | null }) =>
  d === 'mobile' ? <Smartphone size={12} /> : d === 'tablet' ? <Tablet size={12} /> : <Monitor size={12} />

export default function PageVisitsPanel() {
  const [rows, setRows] = useState<Visit[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [onlyLoggedIn, setOnlyLoggedIn] = useState(false)

  const load = (after?: string) => {
    const qs = new URLSearchParams({ ...(after ? { cursor: after } : {}), ...(onlyLoggedIn ? { people: 'loggedin' } : {}) })
    fetch(`/api/admin/page-views?${qs}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) return
        setSummary(d.data.summary)
        setRows(prev => (after ? [...prev, ...d.data.rows] : d.data.rows))
        setCursor(d.data.nextCursor)
      })
      .finally(() => { setLoading(false); setLoadingMore(false) })
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setLoading(true); load() }, [onlyLoggedIn])

  const byDay = useMemo(() => {
    const groups: { day: string; rows: Visit[] }[] = []
    for (const r of rows) {
      const day = formatDate(r.createdAt, 'EEEE d MMMM yyyy')
      const last = groups[groups.length - 1]
      if (last && last.day === day) last.rows.push(r)
      else groups.push({ day, rows: [r] })
    }
    return groups
  }, [rows])

  return (
    <div>
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { icon: Eye, label: 'Pages viewed (24h)', value: summary.viewsToday },
            { icon: Users, label: 'Different visitors (24h)', value: summary.visitorsToday },
            { icon: CalendarDays, label: 'Pages viewed (7 days)', value: summary.viewsThisWeek },
            { icon: Link2, label: 'Referral link clicks (24h)', value: summary.referralClicksToday },
          ].map(t => (
            <div key={t.label} className="stat-card">
              <t.icon size={15} className="text-purple-400 mb-1.5" />
              <div className="text-xl font-black text-white tabular-nums">{t.value.toLocaleString()}</div>
              <div className="text-xs text-gray-500">{t.label}</div>
            </div>
          ))}
        </div>
      )}

      {summary && summary.topPages.length > 0 && (
        <div className="card p-4 mb-5">
          <h3 className="text-sm font-semibold text-gray-200 mb-2">Most visited this week</h3>
          <ul className="text-sm divide-y divide-[#2a2a2a]">
            {summary.topPages.map(p => (
              <li key={p.path} className="flex justify-between py-1.5">
                <span className="text-gray-300 truncate pr-3">{pageName(p.path)}</span>
                <span className="text-gray-500 tabular-nums">{p.views.toLocaleString()} views</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-gray-400 mb-3">
        <input type="checkbox" checked={onlyLoggedIn} onChange={e => setOnlyLoggedIn(e.target.checked)} />
        Only show people who were logged in
      </label>

      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center text-gray-500 text-sm">No visits recorded yet</div>
      ) : (
        <div className="space-y-6">
          {byDay.map(g => (
            <section key={g.day}>
              <h2 className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">{g.day}</h2>
              <div className="card divide-y divide-[#2a2a2a] overflow-hidden">
                {g.rows.map(r => (
                  <div key={r.id} className="px-4 py-2.5 flex items-start gap-3 text-sm">
                    <span className="text-xs text-gray-500 tabular-nums w-16 shrink-0 pt-0.5">{formatDate(r.createdAt, 'h:mm a')}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-gray-100">
                        <span className={r.loggedIn ? 'font-semibold' : 'text-gray-400'}>{r.who}</span>
                        {r.role && r.role !== 'customer' && <span className="text-xs text-purple-300"> ({r.role.replace('_', ' ')})</span>}
                        {' '}{r.isReferralClick ? 'clicked a referral link' : <>visited <span className="text-gray-300">{pageName(r.path)}</span></>}
                      </p>
                      <p className="text-[11px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                        <DeviceIcon d={r.device} />
                        {r.viaLinkOf && <span>via {r.viaLinkOf}&apos;s link</span>}
                        {r.source && SOURCE[r.source] !== '' && <span>· from {SOURCE[r.source] ?? r.source}</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {cursor && (
        <button
          onClick={() => { setLoadingMore(true); load(cursor) }}
          disabled={loadingMore}
          className="mt-4 w-full flex items-center justify-center gap-2 border border-[#2a2a2a] rounded-xl py-2.5 text-sm text-gray-400 hover:text-white"
        >
          {loadingMore && <Loader2 size={14} className="animate-spin" />} Load older visits
        </button>
      )}
      <p className="text-[11px] text-gray-600 mt-4">
        Visitors who aren&apos;t logged in are shown as “Visitor” plus a short tag, so you can follow one person&apos;s visit
        without knowing who they are. Robots and link previews aren&apos;t counted. Visits are kept for 90 days.
      </p>
    </div>
  )
}
