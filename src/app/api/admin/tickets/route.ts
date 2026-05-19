import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, error, forbidden, serverError } from '@/lib/api'
import { generateQRDataURL, generateTicketNumber } from '@/lib/qr'
import crypto from 'crypto'

// GET /api/admin/tickets?search=&eventId=&status=&page=&includeQR=true
// When includeQR=true is set alongside status=physical, returns tickets with regenerated qrDataUrl
export async function GET(req: Request) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()

    const { searchParams } = new URL(req.url)
    const rawSearch = searchParams.get('search') ?? ''
    if (rawSearch.length > 100) return error('Search query too long')
    const search = rawSearch
    const eventId = searchParams.get('eventId') ?? ''
    const status = searchParams.get('status') ?? ''
    const page = parseInt(searchParams.get('page') ?? '1')
    const includeQR = searchParams.get('includeQR') === 'true'
    const limit = 50

    const groupBy = searchParams.get('groupBy')

    // Return physical ticket batch summaries grouped by event + ticket type
    if (groupBy === 'batch') {
      const batches = await prisma.ticket.groupBy({
        by: ['eventId', 'ticketTypeId', 'status'],
        where: { status: 'physical' },
        _count: true,
      })
      const eventIds = [...new Set(batches.map(b => b.eventId))]
      const ticketTypeIds = [...new Set(batches.map(b => b.ticketTypeId).filter(Boolean))] as string[]

      const [events, ticketTypes, activatedCounts] = await Promise.all([
        prisma.event.findMany({ where: { id: { in: eventIds } }, select: { id: true, name: true, date: true, venue: true, posterImage: true } }),
        prisma.ticketType.findMany({ where: { id: { in: ticketTypeIds } }, select: { id: true, name: true, color: true, price: true } }),
        prisma.ticket.groupBy({
          by: ['eventId', 'ticketTypeId'],
          where: { activationCode: { not: null }, status: { in: ['valid', 'used'] } },
          _count: true,
        }),
      ])

      const evMap = Object.fromEntries(events.map(e => [e.id, e]))
      const ttMap = Object.fromEntries(ticketTypes.map(t => [t.id, t]))

      const summary = batches.map(b => ({
        eventId: b.eventId,
        ticketTypeId: b.ticketTypeId,
        event: evMap[b.eventId] ?? null,
        ticketType: b.ticketTypeId ? ttMap[b.ticketTypeId] ?? null : null,
        unsold: b._count,
        activated: activatedCounts.find(a => a.eventId === b.eventId && a.ticketTypeId === b.ticketTypeId)?._count ?? 0,
      }))

      return ok(summary)
    }

    const ticketTypeId = searchParams.get('ticketTypeId') ?? ''

    const where: any = {}
    if (eventId) where.eventId = eventId
    if (ticketTypeId) where.ticketTypeId = ticketTypeId
    if (status) where.status = status
    if (search) {
      where.OR = [
        { ticketNumber: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { phone: { contains: search, mode: 'insensitive' } } },
        { order: { recipientName: { contains: search, mode: 'insensitive' } } },
      ]
    }

    // Physical ticket batch fetch — regenerate QR data URLs
    if (includeQR && status === 'physical') {
      const physicalTickets = await prisma.ticket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          ticketNumber: true,
          qrCode: true,
          activationCode: true,
          event: { select: { name: true, date: true, venue: true, posterImage: true } },
          ticketType: { select: { name: true, color: true, price: true } },
        },
      })

      const withQR = await Promise.all(
        physicalTickets.map(async t => ({
          ticketNumber: t.ticketNumber,
          qrCode: t.qrCode,
          activationCode: t.activationCode ?? '',
          qrDataUrl: await generateQRDataURL(t.qrCode),
          event: t.event,
          ticketType: t.ticketType,
        }))
      )

      // Group by event (first record's event, since all share the same event when filtered)
      const first = withQR[0]
      return ok({
        event: first?.event ?? null,
        ticketType: first?.ticketType ?? null,
        tickets: withQR.map(t => ({ ticketNumber: t.ticketNumber, qrCode: t.qrCode, activationCode: t.activationCode, qrDataUrl: t.qrDataUrl })),
        total: withQR.length,
      })
    }

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          event: { select: { name: true, date: true, venue: true } },
          ticketType: { select: { name: true, color: true, price: true } },
          user: { select: { name: true, phone: true } },
          order: { select: { orderNumber: true, paymentMethod: true, total: true, status: true, recipientName: true, guestName: true } },
        },
      }),
      prisma.ticket.count({ where }),
    ])

    return ok({ tickets, total, page, pages: Math.ceil(total / limit) })
  } catch (e) {
    return serverError(e)
  }
}

// POST /api/admin/tickets — generate physical (inventory) tickets for cash sale
// Tickets are created with status='physical' — NOT counted as sales yet.
// Each ticket gets an activationCode that must be entered when the ticket is sold.
export async function POST(req: Request) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()

    const { eventId, ticketTypeId, quantity } = await req.json()
    if (!eventId || !ticketTypeId || !quantity || quantity < 1 || quantity > 200) {
      return error('eventId, ticketTypeId, and quantity (1–200) are required')
    }

    const [ticketType, event] = await Promise.all([
      prisma.ticketType.findUnique({ where: { id: ticketTypeId } }),
      prisma.event.findUnique({ where: { id: eventId }, select: { id: true, name: true, date: true, venue: true, posterImage: true } }),
    ])
    if (!ticketType || !event) return error('Event or ticket type not found')
    if (ticketType.eventId !== eventId) return error('Ticket type does not belong to this event')

    const existingPhysical = await prisma.ticket.count({
      where: { eventId, ticketTypeId, status: 'physical' },
    })
    const totalAllocated = ticketType.sold + existingPhysical + quantity
    if (totalAllocated > ticketType.capacity) {
      const available = ticketType.capacity - ticketType.sold - existingPhysical
      return error(`Exceeds capacity. ${available > 0 ? `Only ${available} can be generated.` : 'No capacity remaining.'}`)
    }

    const ticketRows = Array.from({ length: quantity }, () => {
      const ticketNumber = generateTicketNumber()
      const qrCode = crypto.randomUUID()
      const activationCode = crypto.randomBytes(4).toString('hex').toUpperCase()
      return { ticketNumber, qrCode, activationCode, userId: session.id, eventId, ticketTypeId, status: 'physical' as const }
    })

    await prisma.$transaction(async (tx) => {
      await tx.ticket.createMany({ data: ticketRows })
    })

    // Generate QR data URLs after the transaction (CPU-bound, non-critical)
    const generated = await Promise.all(
      ticketRows.map(async (t) => ({
        ticketNumber: t.ticketNumber,
        qrCode: t.qrCode,
        activationCode: t.activationCode,
        qrDataUrl: await generateQRDataURL(t.qrCode),
      }))
    )

    return ok({
      event: { name: event.name, date: event.date, venue: event.venue, posterImage: event.posterImage ?? null },
      ticketType: { name: ticketType.name, color: ticketType.color, price: ticketType.price },
      tickets: generated,
    }, 201)
  } catch (e) {
    return serverError(e)
  }
}
