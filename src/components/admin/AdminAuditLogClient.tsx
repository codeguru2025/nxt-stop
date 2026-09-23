'use client'

import { useEffect, useMemo, useState } from 'react'
import AdminLayout from './AdminLayout'
import { ScrollText, Lock, Loader2, ShieldCheck, KeyRound, DollarSign, Users, LogIn, CircleDot, AlertTriangle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { AuditCategory } from '@/lib/auditDescribe'
import PageVisitsPanel from './PageVisitsPanel'

type Row = {
  id: string
  action: string
  ip: string | null
  createdAt: string
  summary: string
  details: string[]
  category: AuditCategory
  alert: boolean
}

type Filter = 'important' | 'all' | 'approval' | 'access' | 'money' | 'security'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'important', label: 'Important' },
  { key: 'approval', label: 'Approvals' },
  { key: 'access', label: 'Admin access' },
  { key: 'money', label: 'Money & sales' },
  { key: 'security', label: 'Logins' },
  { key: 'all', label: 'Everything' },
]

const CATEGORY_ICON: Record<AuditCategory, typeof ScrollText> = {
  approval: ShieldCheck, access: KeyRound, money: DollarSign, sales: DollarSign,
  security: LogIn, events: CircleDot, other: Users,
}

function matches(row: Row, f: Filter): boolean {
  switch (f) {
    case 'all': return true
    // Everything except routine successful logins
    case 'important': return row.alert || row.action !== 'auth.login.success'
    case 'money': return row.category === 'money' || row.category === 'sales'
    default: return row.category === f
  }
}

export default function AdminAuditLogClient() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filter, setFilter] = useState<Filter>('important')
  const [showTech, setShowTech] = useState(false)
  const [tab, setTab] = useState<'actions' | 'visits'>('actions')

  const load = (after?: string) => {
    const url = after ? `/api/admin/audit-log?cursor=${after}&limit=100` : '/api/admin/audit-log?limit=100'
    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (!d.success) { setForbidden(true); return }
        setRows(prev => (after ? [...prev, ...d.data.rows] : d.data.rows))
        setCursor(d.data.nextCursor)
      })
      .finally(() => { setLoading(false); setLoadingMore(false) })
  }

  useEffect(() => { load() }, [])

  const visible = useMemo(() => rows.filter(r => matches(r, filter)), [rows, filter])

  // Group by day so it reads like a diary
  const byDay = useMemo(() => {
    const groups: { day: string; rows: Row[] }[] = []
    for (const r of visible) {
      const day = formatDate(r.createdAt, 'EEEE d MMMM yyyy')
      const last = groups[groups.length - 1]
      if (last && last.day === day) last.rows.push(r)
      else groups.push({ day, rows: [r] })
    }
    return groups
  }, [visible])

  if (forbidden) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh] p-6">
          <div className="card p-8 text-center max-w-sm">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <Lock size={24} className="text-red-400" />
            </div>
            <h3 className="font-bold text-white mb-1">Owner Only</h3>
            <p className="text-gray-500 text-sm">Only platform owner accounts (owner and creator) can view the audit log.</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-5">
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <ScrollText size={20} className="text-purple-400" />
            Audit Log
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            A permanent diary of who did what on the platform. Entries can never be edited or deleted — not even by you.
          </p>
        </div>

        <div className="flex gap-1 mb-5 border-b border-[#2a2a2a]" role="tablist">
          {([['actions', 'What people did'], ['visits', 'Page visits']] as const).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm -mb-px border-b-2 ${tab === k ? 'border-purple-400 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'visits' ? <PageVisitsPanel /> : (<>
        <div className="flex flex-wrap gap-2 mb-5">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                filter === f.key ? 'bg-purple-500/15 border-purple-500/30 text-purple-200' : 'border-[#2a2a2a] text-gray-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-xs text-gray-500">
            <input type="checkbox" checked={showTech} onChange={e => setShowTech(e.target.checked)} />
            Show technical details
          </label>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="card p-10 text-center">
            <ScrollText size={40} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Nothing to show here yet</p>
          </div>
        ) : (
          <div className="space-y-6">
            {byDay.map(g => (
              <section key={g.day}>
                <h2 className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">{g.day}</h2>
                <div className="card divide-y divide-[#2a2a2a] overflow-hidden">
                  {g.rows.map(row => {
                    const Icon = row.alert ? AlertTriangle : CATEGORY_ICON[row.category]
                    return (
                      <div key={row.id} className={`p-4 flex gap-3 ${row.alert ? 'bg-orange-500/[0.04]' : ''}`}>
                        <Icon size={16} className={`shrink-0 mt-0.5 ${row.alert ? 'text-orange-400' : 'text-purple-400/80'}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <p className={`text-sm ${row.alert ? 'text-orange-100' : 'text-gray-100'}`}>{row.summary}</p>
                            <span className="text-xs text-gray-500 shrink-0">{formatDate(row.createdAt, 'h:mm a')}</span>
                          </div>
                          {row.details.length > 0 && (
                            <ul className="mt-1.5 space-y-0.5">
                              {row.details.map((line, i) => <li key={i} className="text-xs text-gray-400">• {line}</li>)}
                            </ul>
                          )}
                          {showTech && (
                            <p className="mt-1.5 text-[11px] text-gray-600 font-mono">
                              {row.action}{row.ip ? ` · IP ${row.ip}` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {cursor && (
          <button
            onClick={() => { setLoadingMore(true); load(cursor) }}
            disabled={loadingMore}
            className="mt-4 w-full flex items-center justify-center gap-2 border border-[#2a2a2a] rounded-xl py-2.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            {loadingMore ? <Loader2 size={14} className="animate-spin" /> : null}
            Load older entries
          </button>
        )}
        </>)}
      </div>
    </AdminLayout>
  )
}
