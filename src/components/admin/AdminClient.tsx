'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from './AdminLayout'
import {
  Ticket, DollarSign, Users, TrendingUp,
  BarChart3, AlertTriangle, Scan, Star, Loader2,
  RefreshCw
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

type Stats = {
  totals: {
    tickets: number; orders: number; revenue: number
    platformFees: number; users: number; activeEvents: number
    liveEvents: number; scansToday: number
  }
  topPartners: any[]
  recentOrders: any[]
  lowStockAlerts: any[]
  eventStats: any[]
}

export default function AdminClient() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    const [authRes, statsRes] = await Promise.all([
      fetch('/api/auth/me').then(r => r.json()),
      fetch('/api/admin/stats').then(r => r.json()),
    ])

    if (!authRes.success || authRes.data.role !== 'admin') {
      router.push('/login')
      return
    }

    if (statsRes.success) setStats(statsRes.data)
    setLoading(false)
    setRefreshing(false)
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
      <div className="p-6">
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
            { label: 'Live Events', value: stats?.totals.liveEvents ?? 0, icon: TrendingUp, color: 'text-red-400', bg: 'bg-red-500/10', sub: 'Currently running', pulse: (stats?.totals.liveEvents ?? 0) > 0 },
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
              {stats?.eventStats.length === 0 ? (
                <p className="text-gray-600 text-sm">No events yet.</p>
              ) : (
                <div className="space-y-3">
                  {stats?.eventStats.slice(0, 5).map(ev => {
                    const totalCap = ev.ticketTypes.reduce((s: number, t: any) => s + t.capacity, 0)
                    const pct = totalCap > 0 ? Math.round((ev._count.tickets / totalCap) * 100) : 0

                    return (
                      <div key={ev.id}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm text-white font-medium truncate flex-1">{ev.name}</span>
                          <div className="flex items-center gap-3 shrink-0 ml-2 text-xs text-gray-500">
                            <span>{ev._count.tickets} sold</span>
                            <span className="text-purple-400 font-semibold">{pct}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              background: pct > 80 ? '#EF4444' : pct > 50 ? '#F59E0B' : '#8B5CF6'
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

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
