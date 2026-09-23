import { prisma } from '@/lib/db'
import { ok, notFound, serverError } from '@/lib/api'
import { publicAvailability } from '@/lib/publicTickets'

export async function GET(
  _req: Request,
  ctx: RouteContext<'/api/events/[id]'>
) {
  try {
    const { id } = await ctx.params

    const event = await prisma.event.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
        status: { in: ['published', 'live', 'ended'] },
      },
      include: {
        ticketTypes: {
          where: { active: true },
          orderBy: { price: 'asc' },
        },
        media: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { socialPosts: true },
        },
      },
    })

    if (!event) return notFound('Event')
    // Public: no sales numbers and no paid stream link
    const { ticketTypes, virtualStreamUrl: _stream, ...rest } = event
    return ok({
      ...rest,
      ticketTypes: ticketTypes.map(({ capacity, sold, ...t }) => ({ ...t, ...publicAvailability(capacity, sold) })),
    })
  } catch (e) {
    return serverError(e)
  }
}
