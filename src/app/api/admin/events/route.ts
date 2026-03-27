import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, error, forbidden, serverError } from '@/lib/api'
import { slugify } from '@/lib/utils'

export async function GET() {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()

    const events = await prisma.event.findMany({
      orderBy: { date: 'desc' },
      include: {
        ticketTypes: true,
        _count: { select: { tickets: true } },
        partners: { include: { partner: { include: { user: { select: { name: true } } } } } },
      },
    })

    return ok(events)
  } catch (e) {
    return serverError(e)
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()

    const body = await req.json()
    const {
      name, description, venue, address, date, endDate,
      posterImage, bannerImage, videoUrl, lineup, hasVirtual,
      virtualPrice, virtualStreamUrl, platformFee, ticketTypes,
      status,
    } = body

    if (!name || !venue || !date) return error('name, venue, and date are required')

    const slug = slugify(name) + '-' + Date.now().toString(36)

    const event = await prisma.event.create({
      data: {
        name,
        slug,
        description,
        venue,
        address,
        date: new Date(date),
        endDate: endDate ? new Date(endDate) : null,
        posterImage,
        bannerImage,
        videoUrl,
        lineup: lineup ? JSON.stringify(lineup) : null,
        hasVirtual: hasVirtual ?? false,
        virtualPrice: virtualPrice ?? 0,
        virtualStreamUrl,
        platformFee: platformFee ?? 0.10,
        status: status ?? 'draft',
        ticketTypes: ticketTypes
          ? {
              create: ticketTypes.map((t: any) => ({
                name: t.name,
                description: t.description,
                price: t.price,
                capacity: t.capacity,
                color: t.color ?? '#8B5CF6',
              })),
            }
          : undefined,
      },
      include: { ticketTypes: true },
    })

    return ok(event, 201)
  } catch (e) {
    return serverError(e)
  }
}
