import { prisma } from '@/lib/db'
import { ok, notFound, serverError } from '@/lib/api'

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
          select: { tickets: true, socialPosts: true },
        },
      },
    })

    if (!event) return notFound('Event')
    return ok(event)
  } catch (e) {
    return serverError(e)
  }
}
