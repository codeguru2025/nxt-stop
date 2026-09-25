import { prisma } from './db'
import { smsCredits } from './smsCredits'

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
  otherProductSold: number
  otherProductRevenue: number
  attendance: number
  scanAnomalies: { invalid: number; alreadyUsed: number; earlyScan: number }
  website: { pageViews: number; visitors: number; referralClicks: number }
  perEvent: { id: string; name: string; ticketsSold: number; revenue: number; attendance: number }[]
  /** null until the sms_credits migration has run */
  sms: SmsSummary | null
}

export type SmsSummary = {
  sent: number        // SMS accepted by the gateway in the window
  failed: number      // refused by the gateway
  noCredit: number    // not sent because credits had run out (email/WhatsApp still went)
  creditsUsed: number // segments of the SMS sent in the window
  creditsAdded: number // top-ups recorded in the window
  bought: number      // all time
  remaining: number
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
  let otherProductSold = 0
  let otherProductRevenue = 0
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
      } else if (item.product) {
        // food | other — no dedicated bucket, but still counted so revenue never silently vanishes
        otherProductSold += item.quantity
        otherProductRevenue += lineTotal
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
  // Events with scan activity but no ticket sales in this window (e.g. sold days earlier,
  // scanned in today) have no name yet — look those up directly rather than showing "Unknown".
  const missingNameIds = Array.from(eventIds).filter((id) => !perEventMap[id])
  const missingNames = missingNameIds.length
    ? await prisma.event.findMany({ where: { id: { in: missingNameIds } }, select: { id: true, name: true } })
    : []
  const nameById = Object.fromEntries(missingNames.map((e) => [e.id, e.name]))

  const perEvent = Array.from(eventIds).map((id) => ({
    id,
    name: perEventMap[id]?.name ?? nameById[id] ?? 'Unknown event',
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
    otherProductSold,
    otherProductRevenue,
    attendance: scanCounts.valid,
    scanAnomalies: {
      invalid: scanCounts.invalid,
      alreadyUsed: scanCounts.alreadyUsed,
      earlyScan: scanCounts.earlyScan,
    },
    perEvent,
    website: await websiteSummary(windowStart, windowEnd),
    sms: await smsSummary(windowStart, windowEnd),
  }
}

/** Visits in the window (robots excluded at record time — see lib/visits.ts). */
async function websiteSummary(from: Date, to: Date): Promise<DailyReport['website']> {
  const inWindow = { createdAt: { gte: from, lte: to } }
  const [pageViews, visitors, referralClicks] = await Promise.all([
    prisma.pageView.count({ where: { ...inWindow, NOT: { path: { startsWith: '/r/' } } } }),
    prisma.pageView.findMany({ where: inWindow, distinct: ['visitorId'], select: { visitorId: true } }).then(r => r.length),
    prisma.pageView.count({ where: { ...inWindow, path: { startsWith: '/r/' } } }),
  ]).catch(() => [0, 0, 0] as const)
  return { pageViews, visitors, referralClicks }
}

async function smsSummary(from: Date, to: Date): Promise<SmsSummary | null> {
  const inWindow = { createdAt: { gte: from, lte: to } }
  try {
    const [byStatus, added, credits] = await Promise.all([
      prisma.smsMessage.groupBy({ by: ['status'], where: inWindow, _count: { id: true }, _sum: { segments: true } }),
      prisma.smsTopUp.aggregate({ where: inWindow, _sum: { credits: true } }),
      smsCredits(),
    ])
    const row = (status: string) => byStatus.find(r => r.status === status)
    return {
      sent: row('sent')?._count.id ?? 0,
      failed: row('failed')?._count.id ?? 0,
      noCredit: row('no_credit')?._count.id ?? 0,
      creditsUsed: row('sent')?._sum.segments ?? 0,
      creditsAdded: added._sum.credits ?? 0,
      bought: credits.bought,
      remaining: credits.remaining,
    }
  } catch {
    return null
  }
}
