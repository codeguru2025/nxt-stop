import { prisma } from '@/lib/db'
import { requireAnyCapability } from '@/lib/auth'
import { ok, forbidden, serverError } from '@/lib/api'

type Row = { code: string; clicks: number; people: number; purchases: number; buyers: number; tickets: number; sales: number }

// GET /api/admin/referral-leaderboard?days=7|30|90 — every referral link (customer and
// partner) with clicks, reach and sales in the period, ranked by sales. Visit numbers
// only go back 90 days (PageView retention).
export async function GET(req: Request) {
  try {
    const session = await requireAnyCapability(['referrals', 'partners']).catch(() => null)
    if (!session) return forbidden()

    const daysParam = parseInt(new URL(req.url).searchParams.get('days') ?? '30', 10)
    const days = [7, 30, 90].includes(daysParam) ? daysParam : 30
    const since = new Date(Date.now() - days * 86_400_000)

    // A partner sale may carry only partnerId — credit it to that partner's code
    const rows = await prisma.$queryRaw<Row[]>`
      WITH visits AS (
        SELECT "referralCode" AS code,
               count(*) FILTER (WHERE path LIKE '/r/%')::int AS clicks,
               count(DISTINCT "visitorId")::int AS people
        FROM "PageView"
        WHERE "referralCode" IS NOT NULL AND "createdAt" >= ${since}
        GROUP BY 1
      ),
      credited AS (
        SELECT o.id, o."userId", o.total, COALESCE(o."referralCode", p."referralCode") AS code
        FROM "Order" o LEFT JOIN "Partner" p ON p.id = o."partnerId"
        WHERE o.status = 'paid' AND o."paidAt" >= ${since}
          AND (o."referralCode" IS NOT NULL OR o."partnerId" IS NOT NULL)
      ),
      sales AS (
        SELECT code, count(*)::int AS purchases, count(DISTINCT "userId")::int AS buyers, COALESCE(sum(total), 0)::float AS sales
        FROM credited GROUP BY code
      ),
      tix AS (
        SELECT c.code, COALESCE(sum(i.quantity), 0)::int AS tickets
        FROM credited c JOIN "OrderItem" i ON i."orderId" = c.id
        WHERE i."ticketTypeId" IS NOT NULL
        GROUP BY c.code
      )
      SELECT code,
             COALESCE(v.clicks, 0) AS clicks, COALESCE(v.people, 0) AS people,
             COALESCE(s.purchases, 0) AS purchases, COALESCE(s.buyers, 0) AS buyers,
             COALESCE(t.tickets, 0) AS tickets, COALESCE(s.sales, 0) AS sales
      FROM visits v FULL JOIN sales s USING (code) FULL JOIN tix t USING (code)
      WHERE code IS NOT NULL
      ORDER BY sales DESC, clicks DESC
      LIMIT 100`

    const codes = rows.map(r => r.code)
    const [users, partners] = await Promise.all([
      prisma.user.findMany({ where: { referralCode: { in: codes } }, select: { referralCode: true, name: true, phone: true } }),
      prisma.partner.findMany({
        where: { referralCode: { in: codes } },
        select: { referralCode: true, type: true, businessName: true, user: { select: { name: true, phone: true } } },
      }),
    ])
    const owner = new Map<string, { name: string; phone: string; kind: string; detail: string | null }>()
    for (const u of users) if (u.referralCode) owner.set(u.referralCode, { name: u.name, phone: u.phone, kind: 'Customer', detail: null })
    for (const p of partners) owner.set(p.referralCode, { name: p.user.name, phone: p.user.phone, kind: 'Partner', detail: p.businessName ?? p.type })

    return ok({
      days,
      links: rows
        .filter(r => owner.has(r.code)) // skip codes whose owner no longer exists
        .map(r => ({
          ...r,
          sales: Math.round(r.sales * 100) / 100,
          conversionRate: r.people > 0 ? Math.round((r.buyers / r.people) * 1000) / 10 : null,
          owner: owner.get(r.code)!,
        })),
    })
  } catch (e) {
    return serverError(e)
  }
}
