import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, forbidden, serverError } from '@/lib/api'
import { redis } from '@/lib/redis'

const CACHE_KEY = 'admin:stats'
const CACHE_TTL = 30 // 30 seconds

export async function GET() {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()

    // Try Redis cache first
    if (redis) {
      try {
        const cached = await redis.get(CACHE_KEY)
        if (cached) return ok(JSON.parse(cached))
      } catch { /* fall through to DB */ }
    }

    // Auto-flag events whose end time has passed (matches orders cutoff logic)
    const now = new Date()
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    await prisma.event.updateMany({
      where: {
        status: { in: ['published', 'live'] },
        OR: [
          { endDate: { lt: now } },
          { endDate: null, date: { lt: dayAgo } },
        ],
      },
      data: { status: 'ended' },
    }).catch(() => {})

    const [
      totalTickets,
      totalOrders,
      totalRevenue,
      totalPlatformFees,
      totalUsers,
      activeEvents,
      liveEvents,
      scansToday,
      topPartners,
      recentOrders,
      failedOrders,
      stockAlerts,
    ] = await Promise.all([
      prisma.ticket.count({ where: { status: { not: 'physical' } } }),
      prisma.order.count({ where: { status: 'paid' } }),
      prisma.order.aggregate({ where: { status: 'paid' }, _sum: { subtotal: true } }),
      prisma.order.aggregate({ where: { status: 'paid' }, _sum: { platformFees: true } }),
      prisma.user.count(),
      prisma.event.count({ where: { status: 'published' } }),
      prisma.event.count({ where: { status: 'live' } }),
      prisma.scanLog.count({
        where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }, result: 'valid' },
      }),
      prisma.partner.findMany({
        orderBy: { totalSales: 'desc' },
        take: 5,
        include: { user: { select: { name: true, phone: true } } },
      }),
      prisma.order.findMany({
        where: { status: 'paid' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { name: true, phone: true } }, items: true },
      }),
      prisma.order.findMany({
        where: { status: 'failed' },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        include: {
          user: { select: { id: true, name: true, phone: true } },
          items: { take: 1 },
        },
      }),
      prisma.product.findMany({ where: { active: true } }).catch(() => []),
    ])

    const lowStock = (stockAlerts as any[]).filter((p: any) => p.stock <= p.lowStockAt)

    const eventStats = await prisma.event.findMany({
      where: { status: { in: ['published', 'live', 'ended'] } },
      orderBy: { date: 'desc' },
      include: {
        _count: { select: { tickets: true, scanLogs: true } },
        ticketTypes: {
          include: {
            _count: { select: { tickets: true } },
          },
        },
        products: { where: { active: true }, select: { id: true, name: true, price: true, sold: true } },
      },
    })

    // Attendance per event (valid scans)
    const attendanceRaw = await prisma.scanLog.groupBy({
      by: ['eventId'],
      where: { result: 'valid' },
      _count: { id: true },
    }).catch(() => [])
    const attendanceMap = Object.fromEntries((attendanceRaw as any[]).map((r: any) => [r.eventId, r._count.id]))

    // Revenue per event from order items (lean select + safety cap to bound memory)
    const eventItemRevenue = await prisma.orderItem.findMany({
      where: { ticketTypeId: { not: null }, order: { status: 'paid' } },
      select: {
        price: true,
        quantity: true,
        ticketType: { select: { eventId: true } },
      },
      take: 50000,
    }).catch(() => [])
    const revenueByEvent: Record<string, number> = {}
    for (const item of eventItemRevenue as any[]) {
      const eid = item.ticketType?.eventId
      if (eid) revenueByEvent[eid] = (revenueByEvent[eid] ?? 0) + Number(item.price) * item.quantity
    }

    const enrichedEventStats = eventStats.map((ev: any) => {
      const totalCap = ev.ticketTypes.reduce((s: number, t: any) => s + t.capacity, 0)
      const totalSold = ev.ticketTypes.reduce((s: number, t: any) => s + t.sold, 0)
      const admissions = attendanceMap[ev.id] ?? 0
      const ticketRevenue = revenueByEvent[ev.id] ?? 0
      const merchRevenue = ev.products.reduce((s: number, p: any) => s + Number(p.price) * p.sold, 0)

      const fillPct = totalCap > 0 ? Math.round((totalSold / totalCap) * 100) : 0
      const admissionPct = totalSold > 0 ? Math.round((admissions / totalSold) * 100) : 0

      // Intelligent insights
      const insights: string[] = []
      if (fillPct >= 95) insights.push('Sold out — consider adding capacity')
      else if (fillPct >= 80) insights.push('Almost full — strong demand')
      else if (fillPct < 30 && ev.status === 'published') insights.push('Low ticket sales — boost promotion')
      if (admissionPct > 90 && ev.status === 'ended') insights.push('Excellent attendance rate')
      else if (admissionPct < 50 && ev.status === 'ended' && totalSold > 0) insights.push('Many no-shows — review gate process')
      if (merchRevenue > ticketRevenue * 0.2) insights.push('Strong merch/product sales')

      return {
        id: ev.id,
        name: ev.name,
        date: ev.date,
        status: ev.status,
        totalCapacity: totalCap,
        totalSold,
        admissions,
        fillPct,
        admissionPct,
        ticketRevenue,
        merchRevenue,
        totalRevenue: ticketRevenue + merchRevenue,
        ticketTypes: ev.ticketTypes.map((t: any) => ({
          id: t.id,
          name: t.name,
          color: t.color,
          price: Number(t.price),
          capacity: t.capacity,
          sold: t.sold,
          revenue: Number(t.price) * t.sold,
        })),
        insights,
        _count: ev._count,
      }
    })

    // Per-gate-scanner breakdown (all-time)
    const scannerRaw = await prisma.scanLog.groupBy({
      by: ['scannedBy', 'result'],
      _count: { id: true },
    }).catch(() => [])

    const scannerMap: Record<string, { valid: number; invalid: number; early: number; used: number; total: number }> = {}
    for (const row of scannerRaw as any[]) {
      const uid = row.scannedBy
      if (!uid) continue
      if (!scannerMap[uid]) scannerMap[uid] = { valid: 0, invalid: 0, early: 0, used: 0, total: 0 }
      const cnt = row._count.id
      scannerMap[uid].total += cnt
      if (row.result === 'valid')          scannerMap[uid].valid += cnt
      else if (row.result === 'invalid')   scannerMap[uid].invalid += cnt
      else if (row.result === 'early_scan') scannerMap[uid].early += cnt
      else if (row.result === 'already_used') scannerMap[uid].used += cnt
    }

    const scannerIds = Object.keys(scannerMap)
    const scannerUsers = scannerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: scannerIds } },
          select: { id: true, name: true, phone: true, role: true },
        })
      : []

    const gateStats = scannerUsers
      .map((u: any) => ({ ...u, ...scannerMap[u.id] }))
      .sort((a: any, b: any) => b.total - a.total)

    const data = {
      totals: {
        tickets: totalTickets,
        orders: totalOrders,
        revenue: Number(totalRevenue._sum.subtotal ?? 0),
        platformFees: Number(totalPlatformFees._sum.platformFees ?? 0),
        users: totalUsers,
        activeEvents,
        liveEvents,
        scansToday,
        failedPayments: failedOrders.length,
      },
      topPartners,
      recentOrders,
      failedOrders,
      lowStockAlerts: lowStock,
      eventStats: enrichedEventStats,
      gateStats,
    }

    // Cache result asynchronously
    if (redis) {
      redis.set(CACHE_KEY, JSON.stringify(data), 'EX', CACHE_TTL).catch(() => {})
    }

    return ok(data)
  } catch (e) {
    return serverError(e)
  }
}
