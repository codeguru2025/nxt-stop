import { prisma } from '@/lib/db'
import { requireCapability } from '@/lib/auth'
import { ok, error, forbidden, serverError } from '@/lib/api'
import { generateTicketNumber } from '@/lib/qr'
import crypto from 'crypto'
import { holdForApproval } from '@/lib/approvals'
import { describeTicketPrint } from '@/lib/approvalDescribe'

// GET /api/admin/tickets?search=&eventId=&ticketTypeId=&status=&page=&all=true
// When all=true is set alongside status=physical, returns every matching ticket (unpaginated) for printing
export async function GET(req: Request) {
  try {
    const session = await requireCapability('tickets').catch(() => null)
    if (!session) return forbidden()

    const { searchParams } = new URL(req.url)
    const rawSearch = searchParams.get('search') ?? ''
    if (rawSearch.length > 100) return error('Search query too long')
    const search = rawSearch
    const eventId = searchParams.get('eventId') ?? ''
    const status = searchParams.get('status') ?? ''
    const page = parseInt(searchParams.get('page') ?? '1')
    const all = searchParams.get('all') === 'true'
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

    // Physical ticket batch fetch — every matching ticket, no page limit, so a whole
    // ticket type can be reprinted. QR images are drawn in the browser from qrCode,
    // which keeps the response small for batches of thousands.
    if (all && status === 'physical') {
      const physicalTickets = await prisma.ticket.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          ticketNumber: true,
          qrCode: true,
          activationCode: true,
          event: { select: { name: true, date: true, venue: true, posterImage: true } },
          ticketType: { select: { name: true, color: true, price: true } },
        },
      })

      // Group by event (first record's event, since all share the same event when filtered)
      const first = physicalTickets[0]
      return ok({
        event: first?.event ?? null,
        ticketType: first?.ticketType ?? null,
        tickets: physicalTickets.map(t => ({ ticketNumber: t.ticketNumber, qrCode: t.qrCode, activationCode: t.activationCode ?? '' })),
        total: physicalTickets.length,
      })
    }

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        // id breaks ties: a generated batch shares one createdAt, and without a unique
        // tiebreaker pages overlap and skip tickets
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
    const session = await requireCapability('tickets').catch(() => null)
    if (!session) return forbidden()

    const body = await req.json()
    const { eventId, ticketTypeId, quantity } = body
    // No fixed ceiling: the ticket type's remaining capacity (checked below) is the limit.
    if (!eventId || !ticketTypeId || !Number.isInteger(quantity) || quantity < 1) {
      return error('eventId, ticketTypeId, and a whole-number quantity of at least 1 are required')
    }

    const [ticketType, event] = await Promise.all([
      prisma.ticketType.findUnique({ where: { id: ticketTypeId } }),
      prisma.event.findUnique({ where: { id: eventId }, select: { id: true, name: true, date: true, venue: true, posterImage: true } }),
    ])
    if (!ticketType || !event) return error('Event or ticket type not found')
    if (ticketType.eventId !== eventId) return error('Ticket type does not belong to this event')

    const capacityError = (available: number) =>
      `Exceeds capacity. ${available > 0 ? `Only ${available} can be generated.` : 'No capacity remaining.'}`

    // Checked up front so an impossible batch is never sent for approval; re-checked under lock below
    const existingPhysical = await prisma.ticket.count({
      where: { eventId, ticketTypeId, status: 'physical' },
    })
    if (ticketType.sold + existingPhysical + quantity > ticketType.capacity) {
      return error(capacityError(ticketType.capacity - ticketType.sold - existingPhysical))
    }

    const held = await holdForApproval(req, session, {
      action: 'ticket.print', capability: 'tickets', route: '/api/admin/tickets', body,
      entityType: 'TicketType', entityId: String(ticketTypeId), describe: () => describeTicketPrint(body),
    })
    if (held) return held

    // Codes are 32 random bits, so big batches can collide with each other or with
    // codes already in the table. Duplicates inside the batch are skipped here; a clash
    // with an existing row fails the unique index and the whole batch is retried.
    const makeRows = () => {
      const numbers = new Set<string>(), codes = new Set<string>()
      while (numbers.size < quantity) numbers.add(generateTicketNumber())
      while (codes.size < quantity) codes.add(crypto.randomBytes(4).toString('hex').toUpperCase())
      const codeList = [...codes]
      return [...numbers].map((ticketNumber, i) => ({
        ticketNumber, qrCode: crypto.randomUUID(), activationCode: codeList[i],
        userId: session.id, eventId, ticketTypeId, status: 'physical' as const,
      }))
    }

    let ticketRows = makeRows()
    for (let attempt = 1; ; attempt++) {
      try {
        await prisma.$transaction(async (tx) => {
          // Serialise concurrent batches for this ticket type so two can't both pass the capacity check
          await tx.$executeRaw`SELECT id FROM "TicketType" WHERE id = ${ticketTypeId} FOR UPDATE`
          const [fresh, physical] = await Promise.all([
            tx.ticketType.findUnique({ where: { id: ticketTypeId }, select: { sold: true, capacity: true } }),
            tx.ticket.count({ where: { eventId, ticketTypeId, status: 'physical' } }),
          ])
          if (!fresh || fresh.sold + physical + quantity > fresh.capacity) {
            throw Object.assign(new Error(capacityError(fresh ? fresh.capacity - fresh.sold - physical : 0)), { status: 409 })
          }
          // Insert in chunks so large batches stay well under the database's bind-parameter limit
          for (let i = 0; i < ticketRows.length; i += 1000) {
            await tx.ticket.createMany({ data: ticketRows.slice(i, i + 1000) })
          }
        }, { timeout: 60_000 })
        break
      } catch (e) {
        if ((e as { status?: number }).status === 409) return error((e as Error).message, 409)
        if ((e as { code?: string })?.code === 'P2002' && attempt < 3) { ticketRows = makeRows(); continue }
        throw e
      }
    }

    // QR images are drawn in the browser from qrCode, so the response stays small
    return ok({
      event: { name: event.name, date: event.date, venue: event.venue, posterImage: event.posterImage ?? null },
      ticketType: { name: ticketType.name, color: ticketType.color, price: ticketType.price },
      tickets: ticketRows.map(t => ({ ticketNumber: t.ticketNumber, qrCode: t.qrCode, activationCode: t.activationCode })),
    }, 201)
  } catch (e) {
    return serverError(e)
  }
}
