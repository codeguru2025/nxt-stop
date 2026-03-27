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

    return ok(events)
  } catch (e) {
    return serverError(e)
  }
}
