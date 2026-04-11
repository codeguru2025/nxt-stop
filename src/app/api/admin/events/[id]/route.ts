import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, error, forbidden, notFound, serverError } from '@/lib/api'

export async function GET(
  _req: Request,
  ctx: RouteContext<'/api/admin/events/[id]'>
) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()
    const { id } = await ctx.params

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        ticketTypes: true,
        media: { orderBy: { order: 'asc' } },
        products: true,
        partners: {
          include: {
            partner: { include: { user: { select: { name: true, phone: true } } } },
          },
        },
        _count: { select: { tickets: true, scanLogs: true, socialPosts: true } },
      },
    })

    if (!event) return notFound('Event')
    return ok(event)
  } catch (e) {
    return serverError(e)
  }
}

export async function PATCH(
  req: Request,
  ctx: RouteContext<'/api/admin/events/[id]'>
) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()
    const { id } = await ctx.params

    const body = await req.json()
    const {
      name, description, venue, address, date, endDate, status,
      posterImage, bannerImage, videoUrl, lineup, hasVirtual,
      virtualPrice, virtualStreamUrl, virtualActive, platformFee,
      lat, lng,
    } = body

    if (lat !== undefined && lat !== null) {
      const v = parseFloat(lat)
      if (isNaN(v) || v < -90 || v > 90) return error('Latitude must be between -90 and 90')
    }
    if (lng !== undefined && lng !== null) {
      const v = parseFloat(lng)
      if (isNaN(v) || v < -180 || v > 180) return error('Longitude must be between -180 and 180')
    }

    const event = await prisma.event.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(venue && { venue }),
        ...(address !== undefined && { address }),
        ...(date && { date: new Date(date) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(status && { status }),
        ...(posterImage !== undefined && { posterImage }),
        ...(bannerImage !== undefined && { bannerImage }),
        ...(videoUrl !== undefined && { videoUrl }),
        ...(lineup !== undefined && { lineup: lineup ? JSON.stringify(lineup) : null }),
        ...(hasVirtual !== undefined && { hasVirtual }),
        ...(virtualPrice !== undefined && { virtualPrice }),
        ...(virtualStreamUrl !== undefined && { virtualStreamUrl }),
        ...(virtualActive !== undefined && { virtualActive }),
        ...(platformFee !== undefined && { platformFee }),
        ...(lat !== undefined && { lat: lat ? parseFloat(lat) : null }),
        ...(lng !== undefined && { lng: lng ? parseFloat(lng) : null }),
      },
    })

    if (body.ticketTypes?.length) {
      for (const tt of body.ticketTypes) {
        if (tt.id) {
          await prisma.ticketType.updateMany({
            where: { id: tt.id, eventId: id },
            data: {
              ...(tt.name !== undefined && { name: tt.name }),
              ...(tt.price !== undefined && { price: parseFloat(String(tt.price)) }),
              ...(tt.capacity !== undefined && { capacity: parseInt(String(tt.capacity)) }),
              ...(tt.color !== undefined && { color: tt.color }),
              ...(tt.description !== undefined && { description: tt.description }),
            },
          })
        } else if (tt.name && tt.capacity) {
          await prisma.ticketType.create({
            data: {
              eventId: id,
              name: tt.name,
              price: parseFloat(String(tt.price ?? 0)),
              capacity: parseInt(String(tt.capacity)),
              color: tt.color ?? '#8B5CF6',
              description: tt.description ?? null,
            },
          })
        }
      }
    }

    const updated = await prisma.event.findUnique({
      where: { id },
      include: { ticketTypes: true },
    })

    return ok(updated)
  } catch (e) {
    return serverError(e)
  }
}

export async function DELETE(
  _req: Request,
  ctx: RouteContext<'/api/admin/events/[id]'>
) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()
    const { id } = await ctx.params

    const soldTickets = await prisma.ticket.count({
      where: { eventId: id, status: { in: ['valid', 'used'] } },
    })
    if (soldTickets > 0) {
      return error(`Cannot delete event with ${soldTickets} sold ticket(s). Cancel or refund them first.`)
    }

    await prisma.event.delete({ where: { id } })
    return ok({ deleted: true })
  } catch (e) {
    return serverError(e)
  }
}
