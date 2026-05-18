'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from './AdminLayout'
import {
  Ticket, DollarSign, Users, TrendingUp,
  BarChart3, AlertTriangle, Scan, Star, Loader2,
  RefreshCw, XCircle, Phone, Lightbulb, ChevronDown, ChevronUp, ScanLine
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

type EventStat = {
  id: string; name: string; date: string; status: string
  totalCapacity: number; totalSold: number; admissions: number
  fillPct: number; admissionPct: number
  ticketRevenue: number; merchRevenue: number; totalRevenue: number
  ticketTypes: { id: string; name: string; color: string; price: number; capacity: number; sold: number; revenue: number }[]
  insights: string[]
}

type GateStat = {
  id: string; name: string; phone: string; role: string
  total: number; valid: number; invalid: number; early: number; used: number
}

type Stats = {
  totals: {
    tickets: number; orders: number; revenue: number
    platformFees: number; users: number; activeEvents: number
    liveEvents: number; scansToday: number; failedPayments: number
  }
  topPartners: any[]
  recentOrders: any[]
  failedOrders: any[]
  lowStockAlerts: any[]
  eventStats: EventStat[]
  gateStats: GateStat[]
}

export default function AdminClient() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null)

  const load = async () => {
    try {
      const [authRes, statsRes] = await Promise.all([
        fetch('/api/auth/me').then(r => r.json()),
        fetch('/api/admin/stats').then(r => r.json()),
      ])

      if (!authRes.success || authRes.data.role !== 'admin') {
        router.push('/login')
        return
      }

      if (statsRes.success) setStats(statsRes.data)
    } catch {
      // Network error — still clear loading state
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  const refresh = () => { setRefreshing(true); load() }

  if (loading) return (
    <AdminLayout>
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={32} className="animate-spin text-purple-500" />
      </div>
    </AdminLayout>
  )

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">Control Center</h1>
            <p className="text-gray-500 text-sm mt-0.5">Real-time platform overview</p>
          </div>
          <button onClick={refresh} disabled={refreshing} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-[#2a2a2a] rounded-lg px-3 py-2 transition-all hover:border-[#3a3a3a]">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Tickets', value: stats?.totals.tickets ?? 0, icon: Ticket, color: 'text-purple-400', bg: 'bg-purple-500/10', sub: `${stats?.totals.scansToday ?? 0} scanned today` },
            { label: 'Revenue', value: formatCurrency(stats?.totals.revenue ?? 0), icon: DollarSign, color: 'text-green-400', bg: 'bg-green-500/10', sub: `${formatCurrency(stats?.totals.platformFees ?? 0)} in fees` },
            { label: 'Total Users', value: stats?.totals.users ?? 0, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10', sub: `${stats?.totals.activeEvents ?? 0} active events` },
            { label: 'Failed Payments', value: stats?.totals.failedPayments ?? 0, icon: XCircle, color: 'text-orange-400', bg: 'bg-orange-500/10', sub: 'Need follow-up', pulse: (stats?.totals.failedPayments ?? 0) > 0 },
          ].map(kpi => (
            <div key={kpi.label} className="stat-card">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                  <kpi.icon size={18} className={`${kpi.color} ${kpi.pulse ? 'pulse-glow' : ''}`} />
                </div>
              </div>
              <div className="text-2xl font-black text-white">{kpi.value}</div>
              <div className="text-xs text-gray-600 mt-0.5">{kpi.label}</div>
              {kpi.sub && <div className="text-xs text-gray-700 mt-0.5">{kpi.sub}</div>}
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Event stats */}
          <div className="lg:col-span-2">
            <div className="card p-5">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <BarChart3 size={16} className="text-purple-400" />
                Event Performance
              </h3>
              {!stats?.eventStats.length ? (
                <p className="text-gray-600 text-sm">No events yet.</p>
              ) : (
                <div className="space-y-3">
                  {stats.eventStats.map(ev => {
                    const isOpen = expandedEvent === ev.id
                    return (
                      <div key={ev.id} className="rounded-xl border border-[#2a2a2a] overflow-hidden">
                        <button
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
                          onClick={() => setExpandedEvent(isOpen ? null : ev.id)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                              ev.status === 'live' ? 'bg-green-500/20 text-green-400' :
                              ev.status === 'ended' ? 'bg-gray-500/20 text-gray-400' :
                              'bg-purple-500/20 text-purple-400'
                            }`}>{ev.status}</span>
                            <span className="text-sm text-white font-medium truncate">{ev.name}</span>
                          </div>
                          <div className="flex items-center gap-4 shrink-0 ml-3">
                            <span className="text-xs text-gray-500 hidden sm:block">{ev.totalSold}/{ev.totalCapacity} sold</span>
                            <span className={`text-xs font-bold ${ev.fillPct >= 80 ? 'text-red-400' : 'text-purple-400'}`}>{ev.fillPct}%</span>
                            {isOpen ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                          </div>
                        </button>

                        {/* Capacity bar */}
                        <div className="h-1 bg-[#1a1a1a]">
                          <div className="h-full" style={{ width: `${ev.fillPct}%`, background: ev.fillPct >= 95 ? '#EF4444' : ev.fillPct >= 80 ? '#F59E0B' : '#8B5CF6' }} />
                        </div>

                        {isOpen && (
                          <div className="px-4 pb-4 pt-3 space-y-4 bg-[#0f0f0f]">
                            {/* KPIs */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              {[
                                { label: 'Ticket Revenue', value: formatCurrency(ev.ticketRevenue), color: 'text-green-400' },
                                { label: 'Merch / Other', value: formatCurrency(ev.merchRevenue), color: 'text-blue-400' },
                                { label: 'Admissions', value: `${ev.admissions} (${ev.admissionPct}%)`, color: 'text-purple-400' },
                                { label: 'Total Revenue', value: formatCurrency(ev.totalRevenue), color: 'text-yellow-400' },
                              ].map(k => (
                                <div key={k.label} className="bg-[#1a1a1a] rounded-lg p-3">
                                  <div className={`text-base font-black ${k.color}`}>{k.value}</div>
                                  <div className="text-xs text-gray-600 mt-0.5">{k.label}</div>
                                </div>
                              ))}
                            </div>

                            {/* Per-ticket-type breakdown */}
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Ticket Types</p>
                              <div className="space-y-1.5">
                                {ev.ticketTypes.map(t => (
                                  <div key={t.id} className="flex items-center gap-3 text-xs">
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: t.color }} />
                                    <span className="text-gray-300 flex-1">{t.name}</span>
                                    <span className="text-gray-500">{t.sold}/{t.capacity}</span>
                                    <span className="text-white font-medium w-20 text-right">{formatCurrency(t.revenue)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Insights */}
                            {ev.insights.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {ev.insights.map((ins, i) => (
                                  <span key={i} className="flex items-center gap-1 text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-full px-2.5 py-1">
                                    <Lightbulb size={10} /> {ins}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Failed Payments */}
            {(stats?.failedOrders?.length ?? 0) > 0 && (
              <div className="card p-5 mt-4">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <XCircle size={16} className="text-orange-400" />
                  Failed Payments
                  <span className="ml-auto text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">
                    {stats?.failedOrders?.length} need follow-up
                  </span>
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b border-[#2a2a2a]">
                        <th className="text-left pb-2">Customer</th>
                        <th className="text-left pb-2">Phone</th>
                        <th className="text-left pb-2">Item</th>
                        <th className="text-left pb-2">Total</th>
                        <th className="text-left pb-2">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1a1a1a]">
                      {stats?.failedOrders?.map(order => (
                        <tr key={order.id}>
                          <td className="py-2.5 text-gray-300">{order.user?.name ?? order.guestName ?? '—'}</td>
                          <td className="py-2.5">
                            <a
                              href={`https://wa.me/${(order.user?.phone ?? order.whatsappPhone ?? '').replace(/\D/g,'')}`}
                              target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-green-400 hover:text-green-300"
                            >
                              <Phone size={11} />{order.user?.phone ?? order.whatsappPhone ?? '—'}
                            </a>
                          </td>
                          <td className="py-2.5 text-gray-500 text-xs truncate max-w-[140px]">{order.items?.[0]?.name ?? '—'}</td>
                          <td className="py-2.5 text-white font-medium">{formatCurrency(order.total)}</td>
                          <td className="py-2.5 text-gray-600 text-xs">{formatDate(order.updatedAt, 'MMM d, h:mm a')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recent orders */}
            <div className="card p-5 mt-4">
              <h3 className="font-bold text-white mb-4">Recent Orders</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-[#2a2a2a]">
                      <th className="text-left pb-2">Customer</th>
                      <th className="text-left pb-2">Total</th>
                      <th className="text-left pb-2">Method</th>
                      <th className="text-left pb-2">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a1a1a]">
                    {stats?.recentOrders.slice(0, 8).map(order => (
                      <tr key={order.id}>
                        <td className="py-2.5 text-gray-300">{order.user.name}</td>
                        <td className="py-2.5 text-white font-medium">{formatCurrency(order.total)}</td>
                        <td className="py-2.5 text-gray-500 capitalize">{order.paymentMethod ?? '—'}</td>
                        <td className="py-2.5 text-gray-600 text-xs">{formatDate(order.createdAt, 'MMM d, h:mm a')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!stats?.recentOrders.length && (
                  <p className="text-gray-600 text-sm text-center py-4">No orders yet</p>
                )}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Top partners */}
            <div className="card p-5">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <Star size={16} className="text-yellow-400" />
                Top Partners
              </h3>
              {stats?.topPartners.length === 0 ? (
                <p className="text-gray-600 text-sm">No partners yet.</p>
              ) : (
                <div className="space-y-3">
                  {stats?.topPartners.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-[#2a2a2a] text-gray-500'}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white font-medium truncate">{p.user.name}</div>
                        <div className="text-xs text-gray-600 capitalize">{p.type}</div>
                      </div>
                      <div className="text-sm font-bold text-purple-400">{p.totalSales}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Gate Scanner Activity */}
            {(stats?.gateStats?.length ?? 0) > 0 && (
              <div className="card p-5">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <ScanLine size={16} className="text-purple-400" />
                  Gate Scanners
                </h3>
                <div className="space-y-3">
                  {stats?.gateStats?.map(g => (
                    <div key={g.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <div className="text-sm text-white font-medium">{g.name}</div>
                          <div className="text-xs text-gray-600">{g.total} total scans</div>
                        </div>
                        <div className="flex gap-2 text-xs">
                          <span className="text-green-400 font-bold">{g.valid}✓</span>
                          <span className="text-cyan-400 font-bold">{g.early}◷</span>
                          <span className="text-red-400 font-bold">{g.invalid}✗</span>
                        </div>
                      </div>
                      <div className="h-1 bg-[#2a2a2a] rounded-full overflow-hidden flex">
                        <div className="h-full bg-green-500" style={{ width: `${g.total > 0 ? (g.valid/g.total)*100 : 0}%` }} />
                        <div className="h-full bg-cyan-500" style={{ width: `${g.total > 0 ? (g.early/g.total)*100 : 0}%` }} />
                        <div className="h-full bg-red-500" style={{ width: `${g.total > 0 ? (g.invalid/g.total)*100 : 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Low stock alerts */}
            <div className="card p-5">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <AlertTriangle size={16} className="text-orange-400" />
                Low Stock Alerts
              </h3>
              {stats?.lowStockAlerts.length === 0 ? (
                <p className="text-gray-600 text-sm">All stock levels OK</p>
              ) : (
                <div className="space-y-2">
                  {stats?.lowStockAlerts.map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-orange-500/5 border border-orange-500/20 rounded-lg px-3 py-2">
                      <span className="text-sm text-white">{p.name}</span>
                      <span className="text-orange-400 font-bold text-sm">{p.stock} left</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="card p-5">
              <h3 className="font-bold text-white mb-4">Quick Actions</h3>
              <div className="space-y-2">
                {[
                  { href: '/admin/events', label: '+ Create Event' },
                  { href: '/admin/partners', label: '+ Add Partner' },
                  { href: '/gate', label: '🔍 Open Gate Scanner' },
                  { href: '/admin/founders', label: '👤 Manage Founders' },
                ].map(a => (
                  <a key={a.href} href={a.href} className="block w-full text-left text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg px-3 py-2 transition-all">
                    {a.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
