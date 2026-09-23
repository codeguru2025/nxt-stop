import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { ok, unauthorized, serverError } from '@/lib/api'
import { EVENT_TIME_ZONE } from '@/lib/utils'
import { Prisma } from '@/generated/prisma/client'

// GET /api/dashboard/referral-stats?days=7|30|90 — how the logged-in user's referral
// link(s) are doing: clicks, people reached, where they came from, what they looked at,
// and what they bought. Covers their customer link and, if they're a partner, that link.
// Visit data only goes back 90 days (PageView retention); purchase totals are all-time.
export async function GET(req: Request) {
  try {
    const session = await requireAuth().catch(() => null)
    if (!session) return unauthorized()

    const daysParam = parseInt(new URL(req.url).searchParams.get('days') ?? '30', 10)
    const days = [7, 30, 90].includes(daysParam) ? daysParam : 30
    const since = new Date(Date.now() - days * 86_400_000)

    const [me, partner] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.id }, select: { referralCode: true } }),
      prisma.partner.findUnique({ where: { userId: session.id }, select: { id: true, referralCode: true, totalEarned: true } }),
    ])
    const codes = [me?.referralCode, partner?.referralCode].filter((c): c is string => !!c)
    if (codes.length === 0) return ok({ days, codes: [], empty: true })

    const inCodes = { referralCode: { in: codes } }
    const clickWhere = { ...inCodes, path: { startsWith: '/r/' }, createdAt: { gte: since } }
    const visitWhere = { ...inCodes, createdAt: { gte: since } }
    // Orders credited to the link: by code, or by partner id for partner sales
    const orderWhere = {
      status: 'paid',
      OR: [{ referralCode: { in: codes } }, ...(partner ? [{ partnerId: partner.id }] : [])],
    }

    const [
      clicks, clickVisitors, allVisitors, pagesViewed, sources, devices, topPaths,
      ordersInRange, ordersAllTime, rewards,
    ] = await Promise.all([
      prisma.pageView.count({ where: clickWhere }),
      prisma.pageView.findMany({ where: clickWhere, distinct: ['visitorId'], select: { visitorId: true } }),
      prisma.pageView.findMany({ where: visitWhere, distinct: ['visitorId'], select: { visitorId: true } }),
      prisma.pageView.count({ where: { ...visitWhere, NOT: { path: { startsWith: '/r/' } } } }),
      prisma.pageView.groupBy({ by: ['source'], where: clickWhere, _count: { _all: true } }),
      prisma.pageView.groupBy({ by: ['device'], where: visitWhere, _count: { _all: true } }),
      prisma.pageView.groupBy({
        by: ['path'], where: { ...visitWhere, NOT: { path: { startsWith: '/r/' } } },
        _count: { _all: true }, orderBy: { _count: { path: 'desc' } }, take: 6,
      }),
      prisma.order.findMany({
        where: { ...orderWhere, paidAt: { gte: since } },
        select: {
          id: true, userId: true, total: true, paidAt: true,
          items: { select: { quantity: true, ticketTypeId: true, ticketType: { select: { event: { select: { id: true, name: true } } } } } },
        },
      }),
      prisma.order.aggregate({ where: orderWhere, _count: { _all: true }, _sum: { total: true } }),
      prisma.referralReward.findMany({ where: { userId: session.id }, select: { amount: true, status: true } }),
    ])

    const ticketsIn = (os: typeof ordersInRange) =>
      os.reduce((s, o) => s + o.items.filter(i => i.ticketTypeId).reduce((a, i) => a + i.quantity, 0), 0)
    const buyers = new Set(ordersInRange.map(o => o.userId)).size
    const people = allVisitors.length

    // Per event: tickets and value sold through the link
    const perEvent = new Map<string, { name: string; tickets: number; orders: number }>()
    for (const o of ordersInRange) {
      for (const i of o.items) {
        const ev = i.ticketType?.event
        if (!ev) continue
        const row = perEvent.get(ev.id) ?? { name: ev.name, tickets: 0, orders: 0 }
        row.tickets += i.quantity
        perEvent.set(ev.id, row)
      }
      const firstEvent = o.items.find(i => i.ticketType?.event)?.ticketType?.event
      if (firstEvent) perEvent.get(firstEvent.id)!.orders += 1
    }

    // Friendly page names: /events/slug → event name
    const slugs = topPaths.map(p => /^\/events\/([^/]+)$/.exec(p.path)?.[1]).filter((s): s is string => !!s)
    const evBySlug = slugs.length
      ? Object.fromEntries((await prisma.event.findMany({ where: { slug: { in: slugs } }, select: { slug: true, name: true } })).map(e => [e.slug, e.name]))
      : {}
    const pageName = (p: string) => {
      const slug = /^\/events\/([^/]+)$/.exec(p)?.[1]
      if (slug) return evBySlug[slug] ? `Event: ${evBySlug[slug]}` : 'An event page'
      const named: Record<string, string> = { '/': 'Home page', '/events': 'All events', '/merch': 'Merch & pre-orders', '/gallery': 'Gallery', '/videos': 'Videos', '/about': 'About' }
      return named[p] ?? p
    }

    // Daily clicks and purchases, by venue-local day
    const daily = await prisma.$queryRaw<{ day: string; clicks: number; purchases: number }[]>`
      WITH d AS (
        SELECT generate_series(
          (now() AT TIME ZONE ${EVENT_TIME_ZONE})::date - (${days}::int - 1),
          (now() AT TIME ZONE ${EVENT_TIME_ZONE})::date, interval '1 day')::date AS day
      )
      SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
        (SELECT count(*)::int FROM "PageView" p
          WHERE p."referralCode" IN (${Prisma.join(codes)}) AND p.path LIKE '/r/%'
            AND (p."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${EVENT_TIME_ZONE})::date = d.day) AS clicks,
        (SELECT count(*)::int FROM "Order" o
          WHERE o.status = 'paid'
            AND (o."referralCode" IN (${Prisma.join(codes)}) ${partner ? Prisma.sql`OR o."partnerId" = ${partner.id}` : Prisma.empty})
            AND (o."paidAt" AT TIME ZONE 'UTC' AT TIME ZONE ${EVENT_TIME_ZONE})::date = d.day) AS purchases
      FROM d ORDER BY d.day`

    const money = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100
    return ok({
      days,
      codes,
      clicks,
      peopleClicked: clickVisitors.length,
      peopleReached: people,
      pagesViewed,
      purchases: ordersInRange.length,
      buyers,
      ticketsSold: ticketsIn(ordersInRange),
      salesValue: money(ordersInRange.reduce((s, o) => s + Number(o.total), 0)),
      conversionRate: people > 0 ? Math.round((buyers / people) * 1000) / 10 : 0,
      allTime: { purchases: ordersAllTime._count._all, salesValue: money(ordersAllTime._sum.total) },
      earnings: {
        referralPending: money(rewards.filter(r => r.status === 'pending').reduce((s, r) => s + Number(r.amount), 0)),
        referralPaid: money(rewards.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.amount), 0)),
        partnerCommission: partner ? money(partner.totalEarned) : null,
      },
      sources: sources
        .map(s => ({ source: s.source ?? 'unknown', clicks: s._count._all }))
        .sort((a, b) => b.clicks - a.clicks),
      devices: devices
        .map(d => ({ device: d.device ?? 'unknown', visits: d._count._all }))
        .sort((a, b) => b.visits - a.visits),
      topPages: topPaths.map(p => ({ page: pageName(p.path), views: p._count._all })),
      perEvent: [...perEvent.values()].sort((a, b) => b.tickets - a.tickets),
      daily,
    })
  } catch (e) {
    return serverError(e)
  }
}
