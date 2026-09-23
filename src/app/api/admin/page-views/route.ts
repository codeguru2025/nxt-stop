import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { ok, forbidden, serverError } from '@/lib/api'

// GET /api/admin/page-views?cursor=&people=loggedin|all — who visited which pages.
// Platform owners only (same rule as the audit log), re-verified from the DB.
export async function GET(req: Request) {
  try {
    const session = await requireAuth().catch(() => null)
    if (!session) return forbidden()
    const owner = await prisma.user.findUnique({ where: { id: session.id }, select: { isPlatformOwner: true } })
    if (!owner?.isPlatformOwner) return forbidden()

    const url = new URL(req.url)
    const cursor = url.searchParams.get('cursor') ?? undefined
    const onlyLoggedIn = url.searchParams.get('people') === 'loggedin'
    const take = 100

    const dayStart = new Date(Date.now() - 24 * 3600e3)
    const weekStart = new Date(Date.now() - 7 * 24 * 3600e3)

    const [rows, today, todayVisitors, week, topPages, refClicksToday] = await Promise.all([
      prisma.pageView.findMany({
        where: onlyLoggedIn ? { userId: { not: null } } : {},
        orderBy: { createdAt: 'desc' },
        take,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      }),
      prisma.pageView.count({ where: { createdAt: { gte: dayStart }, NOT: { path: { startsWith: '/r/' } } } }),
      prisma.pageView.findMany({ where: { createdAt: { gte: dayStart } }, distinct: ['visitorId'], select: { visitorId: true } }),
      prisma.pageView.count({ where: { createdAt: { gte: weekStart }, NOT: { path: { startsWith: '/r/' } } } }),
      prisma.pageView.groupBy({
        by: ['path'], where: { createdAt: { gte: weekStart }, NOT: { path: { startsWith: '/r/' } } },
        _count: { _all: true }, orderBy: { _count: { path: 'desc' } }, take: 8,
      }),
      prisma.pageView.count({ where: { createdAt: { gte: dayStart }, path: { startsWith: '/r/' } } }),
    ])

    // Names for logged-in visitors and for referral-link owners
    const userIds = [...new Set(rows.map(r => r.userId).filter((x): x is string => !!x))]
    const codes = [...new Set(rows.map(r => r.referralCode).filter((x): x is string => !!x))]
    const [users, refOwners, partners] = await Promise.all([
      userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, role: true } }) : [],
      codes.length ? prisma.user.findMany({ where: { referralCode: { in: codes } }, select: { referralCode: true, name: true } }) : [],
      codes.length ? prisma.partner.findMany({ where: { referralCode: { in: codes } }, select: { referralCode: true, user: { select: { name: true } } } }) : [],
    ])
    const userMap = new Map(users.map(u => [u.id, u]))
    const codeOwner = new Map<string, string>([
      ...refOwners.map(o => [o.referralCode as string, o.name] as [string, string]),
      ...partners.map(p => [p.referralCode, p.user.name] as [string, string]),
    ])

    return ok({
      summary: {
        viewsToday: today,
        visitorsToday: todayVisitors.length,
        viewsThisWeek: week,
        referralClicksToday: refClicksToday,
        topPages: topPages.map(p => ({ path: p.path, views: p._count._all })),
      },
      rows: rows.map(r => {
        const u = r.userId ? userMap.get(r.userId) : undefined
        return {
          id: r.id,
          createdAt: r.createdAt,
          path: r.path,
          isReferralClick: r.path.startsWith('/r/'),
          who: u ? u.name : `Visitor ${r.visitorId.slice(0, 6)}`,
          role: u?.role ?? null,
          loggedIn: !!u,
          visitorTag: r.visitorId.slice(0, 6),
          viaLinkOf: r.referralCode ? codeOwner.get(r.referralCode) ?? r.referralCode : null,
          source: r.source,
          device: r.device,
        }
      }),
      nextCursor: rows.length === take ? rows[rows.length - 1].id : null,
    })
  } catch (e) {
    return serverError(e)
  }
}
