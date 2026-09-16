import { prisma } from './db'

export type DailyReport = {
  windowStart: Date
  windowEnd: Date
  ordersPaid: number
  ordersFailed: number
  ticketsSold: number
  ticketRevenue: number
  merchSold: number
  merchRevenue: number
  liquorSold: number
  liquorRevenue: number
  attendance: number
  scanAnomalies: { invalid: number; alreadyUsed: number; earlyScan: number }
  perEvent: { id: string; name: string; ticketsSold: number; revenue: number; attendance: number }[]
}

export async function buildDailyReport(hoursBack = 24): Promise<DailyReport> {
  const windowEnd = new Date()
  const windowStart = new Date(windowEnd.getTime() - hoursBack * 60 * 60 * 1000)

  const [paidOrders, ordersFailed, scanRows] = await Promise.all([
    prisma.order.findMany({
      where: { status: 'paid', paidAt: { gte: windowStart, lte: windowEnd } },
      include: {
        items: {
          include: {
            product: { select: { category: true } },
            ticketType: { select: { eventId: true, event: { select: { name: true } } } },
          },
        },
      },
    }),
    prisma.order.count({ where: { status: 'failed', updatedAt: { gte: windowStart, lte: windowEnd } } }),
    prisma.scanLog.groupBy({
      by: ['result'],
      where: { createdAt: { gte: windowStart, lte: windowEnd } },
      _count: { id: true },
    }).catch(() => [] as { result: string; _count: { id: number } }[]),
  ])

  let ticketsSold = 0
  let ticketRevenue = 0
  let merchSold = 0
  let merchRevenue = 0
  let liquorSold = 0
  let liquorRevenue = 0
  const perEventMap: Record<string, { name: string; ticketsSold: number; revenue: number }> = {}

  for (const order of paidOrders) {
    for (const item of order.items) {
      const lineTotal = Number(item.price) * item.quantity
      if (item.ticketTypeId && item.ticketType) {
        ticketsSold += item.quantity
        ticketRevenue += lineTotal
        const eid = item.ticketType.eventId
        if (!perEventMap[eid]) {
          perEventMap[eid] = { name: item.ticketType.event.name, ticketsSold: 0, revenue: 0 }
        }
        perEventMap[eid].ticketsSold += item.quantity
        perEventMap[eid].revenue += lineTotal
      } else if (item.product?.category === 'merchandise') {
        merchSold += item.quantity
        merchRevenue += lineTotal
      } else if (item.product?.category === 'drink') {
        liquorSold += item.quantity
        liquorRevenue += lineTotal
      }
    }
  }

  const scanCounts = { valid: 0, invalid: 0, alreadyUsed: 0, earlyScan: 0 }
  for (const row of scanRows) {
    if (row.result === 'valid') scanCounts.valid += row._count.id
    else if (row.result === 'invalid') scanCounts.invalid += row._count.id
    else if (row.result === 'already_used') scanCounts.alreadyUsed += row._count.id
    else if (row.result === 'early_scan') scanCounts.earlyScan += row._count.id
  }

  const attendanceByEvent = await prisma.scanLog.groupBy({
    by: ['eventId'],
    where: { result: 'valid', createdAt: { gte: windowStart, lte: windowEnd } },
    _count: { id: true },
  }).catch(() => [] as { eventId: string; _count: { id: number } }[])
  const attendanceMap = Object.fromEntries(attendanceByEvent.map((r) => [r.eventId, r._count.id]))

  const eventIds = new Set([...Object.keys(perEventMap), ...Object.keys(attendanceMap)])
  const perEvent = Array.from(eventIds).map((id) => ({
    id,
    name: perEventMap[id]?.name ?? 'Unknown event',
    ticketsSold: perEventMap[id]?.ticketsSold ?? 0,
    revenue: perEventMap[id]?.revenue ?? 0,
    attendance: attendanceMap[id] ?? 0,
  }))

  return {
    windowStart,
    windowEnd,
    ordersPaid: paidOrders.length,
    ordersFailed,
    ticketsSold,
    ticketRevenue,
    merchSold,
    merchRevenue,
    liquorSold,
    liquorRevenue,
    attendance: scanCounts.valid,
    scanAnomalies: {
      invalid: scanCounts.invalid,
      alreadyUsed: scanCounts.alreadyUsed,
      earlyScan: scanCounts.earlyScan,
    },
    perEvent,
  }
}
