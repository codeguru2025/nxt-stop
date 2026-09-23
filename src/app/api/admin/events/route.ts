import { prisma } from '@/lib/db'
import { requireCapability } from '@/lib/auth'
import { ok, error, forbidden, serverError } from '@/lib/api'
import { slugify, eventLocalInputToUtc } from '@/lib/utils'
import { generateEventQrCode } from '@/lib/qr'
import crypto from 'crypto'
import { holdForApproval } from '@/lib/approvals'
import { describeEventCreate } from '@/lib/approvalDescribe'

export async function GET() {
  try {
    const session = await requireCapability('events').catch(() => null)
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
    const session = await requireCapability('events').catch(() => null)
    if (!session) return forbidden()

    const body = await req.json()
    const {
      name, description, venue, address, date, endDate,
      posterImage, bannerImage, videoUrl, lineup, hasVirtual,
      virtualPrice, virtualStreamUrl, platformFee, ticketTypes,
      status, lat, lng, slug: slugOverride,
    } = body

    if (!name || !venue || !date) return error('name, venue, and date are required')

    const startAt = eventLocalInputToUtc(date)
    if (isNaN(startAt.getTime())) return error('Invalid start date/time')
    let endAt: Date | null = null
    if (endDate) {
      endAt = eventLocalInputToUtc(endDate)
      if (isNaN(endAt.getTime())) return error('Invalid end date/time')
      if (endAt <= startAt) return error('End time must be after the start time')
    }

    const parsedLat = lat != null ? parseFloat(lat) : null
    const parsedLng = lng != null ? parseFloat(lng) : null
    if (parsedLat != null && (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90)) {
      return error('Latitude must be between -90 and 90')
    }
    if (parsedLng != null && (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180)) {
      return error('Longitude must be between -180 and 180')
    }

    let slug: string
    if (slugOverride && typeof slugOverride === 'string' && slugOverride.trim()) {
      const cleaned = slugOverride.trim().toLowerCase()
      if (!/^[a-z0-9-]+$/.test(cleaned)) return error('Slug may only contain lowercase letters, numbers, and hyphens')
      const existing = await prisma.event.findUnique({ where: { slug: cleaned } })
      if (existing) return error(`Slug "${cleaned}" is already in use by another event`)
      slug = cleaned
    } else {
      slug = slugify(name) + '-' + crypto.randomBytes(4).toString('hex')
    }

    // A draft is invisible to the public; creating straight into a live status needs approval
    if ((status ?? 'draft') !== 'draft') {
      const held = await holdForApproval(req, session, {
        action: 'event.create', capability: 'events', route: '/api/admin/events', body,
        entityType: 'Event', describe: () => describeEventCreate(body),
      })
      if (held) return held
    }

    const event = await prisma.event.create({
      data: {
        name,
        slug,
        description,
        venue,
        address,
        date: startAt,
        endDate: endAt,
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
                active: t.active ?? true,
                salesChannel: t.salesChannel ?? 'both',
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
