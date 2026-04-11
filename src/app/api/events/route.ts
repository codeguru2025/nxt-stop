import { prisma } from '@/lib/db'
import { ok, serverError } from '@/lib/api'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const status = url.searchParams.get('status') ?? 'published'
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20') || 20, 100)

    const ALLOWED_PUBLIC = ['published', 'live']
    const where =
      status === 'all'
        ? { status: { in: ALLOWED_PUBLIC } }
        : status === 'published'
          ? { status: { in: ALLOWED_PUBLIC } }
          : ALLOWED_PUBLIC.includes(status)
            ? { status }
            : { status: { in: ALLOWED_PUBLIC } }

    const events = await prisma.event.findMany({
      where,
      orderBy: { date: 'asc' },
      take: limit,
      include: {
        ticketTypes: {
          where: { active: true },
          orderBy: { price: 'asc' },
        },
        _count: {
          select: { tickets: true },
        },
      },
    })

    const res = ok(events)
    // Cache public event list for 60s at the CDN/browser level.
    // Admin status changes will be visible within a minute.
    res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')
    return res
  } catch (e) {
    return serverError(e)
  }
}
