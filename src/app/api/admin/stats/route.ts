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
        where: {
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          result: 'valid',
        },
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
        include: {
          user: { select: { name: true, phone: true } },
          items: true,
        },
      }),
      prisma.product.findMany({ where: { active: true } }).catch(() => []),
    ])

    const lowStock = (stockAlerts as any[]).filter((p: any) => p.stock <= p.lowStockAt)

    const eventStats = await prisma.event.findMany({
      where: { status: { in: ['published', 'live', 'ended'] } },
      include: {
        _count: { select: { tickets: true, scanLogs: true } },
        ticketTypes: true,
      },
    })

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
      },
      topPartners,
      recentOrders,
      lowStockAlerts: lowStock,
      eventStats,
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
