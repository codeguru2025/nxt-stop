import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, error, forbidden, serverError } from '@/lib/api'
import { slugify } from '@/lib/utils'
import { generateEventQrCode } from '@/lib/qr'
import crypto from 'crypto'

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
      status, lat, lng,
    } = body

    if (!name || !venue || !date) return error('name, venue, and date are required')

    const parsedLat = lat != null ? parseFloat(lat) : null
    const parsedLng = lng != null ? parseFloat(lng) : null
    if (parsedLat != null && (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90)) {
      return error('Latitude must be between -90 and 90')
    }
    if (parsedLng != null && (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180)) {
      return error('Longitude must be between -180 and 180')
    }

    const slug = slugify(name) + '-' + crypto.randomBytes(4).toString('hex')

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
        lat: parsedLat,
        lng: parsedLng,
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

    // Generate QR code pointing to the ticket-purchase page; fire-and-forget on error
    try {
      const qrCodeUrl = await generateEventQrCode(event.id, event.slug)
      await prisma.event.update({ where: { id: event.id }, data: { qrCodeUrl } })
      return ok({ ...event, qrCodeUrl }, 201)
    } catch {
      // QR generation is non-critical — return event without it
    }

    return ok(event, 201)
  } catch (e) {
    return serverError(e)
  }
}
