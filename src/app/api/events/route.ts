import { prisma } from '@/lib/db'
import { ok, serverError } from '@/lib/api'
import { publicAvailability, eventSellingFast } from '@/lib/publicTickets'

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
      },
    })

    // Public: no sales numbers and no paid stream link
    const res = ok(events.map(({ ticketTypes, virtualStreamUrl: _stream, ...e }) => ({
      ...e,
      ticketTypes: ticketTypes.map(({ capacity, sold, ...t }) => ({ ...t, ...publicAvailability(capacity, sold) })),
      sellingFast: eventSellingFast(ticketTypes),
    })))
    // Cache public event list for 60s at the CDN/browser level.
    // Admin status changes will be visible within a minute.
    res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')
    return res
  } catch (e) {
    return serverError(e)
  }
}
