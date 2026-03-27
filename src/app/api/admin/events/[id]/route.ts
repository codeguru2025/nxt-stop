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
            partner: { include: { user: { select: { name: true, email: true } } } },
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
    } = body

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
      },
    })

    return ok(event)
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

    await prisma.event.delete({ where: { id } })
    return ok({ deleted: true })
  } catch (e) {
    return serverError(e)
  }
}
