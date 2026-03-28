import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, forbidden, serverError } from '@/lib/api'

export async function GET() {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()

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
      totalVirtualAttendees,
    ] = await Promise.all([
      prisma.ticket.count(),
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
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.order.findMany({
        where: { status: 'paid' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: { select: { name: true, email: true } },
          items: true,
        },
      }),
      prisma.product.findMany({
        where: { active: true },
      }).catch(() => []),
      prisma.ticket.count({ where: { event: { hasVirtual: true } } }),
    ])

    // Low stock alerts (manual approach)
    const products = await prisma.product.findMany({ where: { active: true } })
    const lowStock = products.filter(p => p.stock <= p.lowStockAt)

    // Tickets sold per event
    const eventStats = await prisma.event.findMany({
      where: { status: { in: ['published', 'live', 'ended'] } },
      include: {
        _count: { select: { tickets: true, scanLogs: true } },
        ticketTypes: true,
      },
    })

    return ok({
      totals: {
        tickets: totalTickets,
        orders: totalOrders,
        revenue: totalRevenue._sum.subtotal ?? 0,
        platformFees: totalPlatformFees._sum.platformFees ?? 0,
        users: totalUsers,
        activeEvents,
        liveEvents,
        scansToday,
      },
      topPartners,
      recentOrders,
      lowStockAlerts: lowStock,
      eventStats,
    })
  } catch (e) {
    return serverError(e)
  }
}
