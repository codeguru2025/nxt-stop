import { prisma } from '@/lib/db'
import { ok, serverError } from '@/lib/api'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const status = url.searchParams.get('status') ?? 'published'
    const limit = parseInt(url.searchParams.get('limit') ?? '20')

    const events = await prisma.event.findMany({
      where: status === 'all' ? undefined : { status },
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
