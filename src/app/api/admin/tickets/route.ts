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
    const search = searchParams.get('search') ?? ''
    const eventId = searchParams.get('eventId') ?? ''
    const status = searchParams.get('status') ?? ''
    const page = parseInt(searchParams.get('page') ?? '1')
    const includeQR = searchParams.get('includeQR') === 'true'
    const limit = 50

    const where: any = {}
    if (eventId) where.eventId = eventId
    if (status) where.status = status
    if (search) {
      where.OR = [
        { ticketNumber: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
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
          event: { select: { name: true, date: true, venue: true } },
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
          user: { select: { name: true, email: true } },
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
      prisma.event.findUnique({ where: { id: eventId }, select: { id: true, name: true, date: true, venue: true } }),
    ])
    if (!ticketType || !event) return error('Event or ticket type not found')

    // Generate tickets as inventory (no order, no sold increment, status=physical)
    const generated: { ticketNumber: string; qrCode: string; qrDataUrl: string; activationCode: string }[] = []
    for (let i = 0; i < quantity; i++) {
      const ticketNumber = generateTicketNumber()
      const qrCode = crypto.randomUUID()
      const qrDataUrl = await generateQRDataURL(qrCode)
      // Short 6-char activation code — easy to type, hard to guess
      const activationCode = crypto.randomBytes(3).toString('hex').toUpperCase()

      await prisma.ticket.create({
        data: {
          ticketNumber,
          qrCode,
          activationCode,
          userId: session.id,
          eventId,
          ticketTypeId,
          status: 'physical', // inventory — not yet sold
          // orderId intentionally omitted — set on activation
        },
      })

      generated.push({ ticketNumber, qrCode, qrDataUrl, activationCode })
    }

    return ok({
      event: { name: event.name, date: event.date, venue: event.venue },
      ticketType: { name: ticketType.name, color: ticketType.color, price: ticketType.price },
      tickets: generated,
    }, 201)
  } catch (e) {
    return serverError(e)
  }
}
