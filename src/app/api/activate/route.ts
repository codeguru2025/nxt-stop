import { prisma } from '@/lib/db'
import { requireGateOrAdmin } from '@/lib/auth'
import { ok, error, unauthorized, serverError } from '@/lib/api'
import { generateOrderNumber } from '@/lib/qr'

// POST /api/activate — activate a physical ticket when it is sold for cash
// Requires gate_staff or admin auth.
// Body: { activationCode: string }
export async function POST(req: Request) {
  try {
    const session = await requireGateOrAdmin().catch(() => null)
    if (!session) return unauthorized()

    const { activationCode } = await req.json()
    if (!activationCode?.trim()) return error('Activation code is required')

    const ticket = await prisma.ticket.findUnique({
      where: { activationCode: activationCode.trim().toUpperCase() },
      include: {
        event:      { select: { id: true, name: true, date: true, venue: true } },
        ticketType: { select: { id: true, name: true, color: true, price: true } },
      },
    })

    if (!ticket) return error('Invalid activation code — ticket not found')
    if (ticket.status === 'valid' || ticket.status === 'used') {
      return error('Ticket is already activated and sold')
    }
    if (ticket.status !== 'physical') {
      return error(`Cannot activate ticket with status: ${ticket.status}`)
    }

    // Create a cash sale order to record the revenue
    const orderNumber = generateOrderNumber()
    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId: ticket.userId,
        subtotal: ticket.ticketType.price,
        platformFees: 0,
        total: ticket.ticketType.price,
        status: 'paid',
        paymentMethod: 'cash',
        paidAt: new Date(),
        items: {
          create: {
            ticketTypeId: ticket.ticketTypeId,
            name: `${ticket.ticketType.name} - ${ticket.event.name}`,
            price: ticket.ticketType.price,
            quantity: 1,
          },
        },
      },
    })

    // Activate the ticket
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: 'valid',
        activatedAt: new Date(),
        activatedById: session.id,
        orderId: order.id,
      },
    })

    // Now it's a real sale — increment sold counter
    await prisma.ticketType.update({
      where: { id: ticket.ticketTypeId },
      data: { sold: { increment: 1 } },
    })

    return ok({
      orderNumber,
      ticket: {
        number: ticket.ticketNumber,
        event: ticket.event.name,
        venue: ticket.event.venue,
        date: ticket.event.date,
        type: ticket.ticketType.name,
        color: ticket.ticketType.color,
        price: ticket.ticketType.price,
      },
    })
  } catch (e) {
    return serverError(e)
  }
}

// GET /api/activate?code=XXX — look up a ticket by activation code (preview before confirming)
export async function GET(req: Request) {
  try {
    const session = await requireGateOrAdmin().catch(() => null)
    if (!session) return unauthorized()

    const { searchParams } = new URL(req.url)
    const activationCode = searchParams.get('code')?.trim().toUpperCase()
    if (!activationCode) return error('code is required')

    const ticket = await prisma.ticket.findUnique({
      where: { activationCode },
      include: {
        event:      { select: { name: true, date: true, venue: true } },
        ticketType: { select: { name: true, color: true, price: true } },
      },
    })

    if (!ticket) return error('Invalid activation code')

    return ok({
      ticketNumber: ticket.ticketNumber,
      status: ticket.status,
      event: ticket.event.name,
      venue: ticket.event.venue,
      date: ticket.event.date,
      type: ticket.ticketType.name,
      color: ticket.ticketType.color,
      price: ticket.ticketType.price,
      alreadyActivated: ticket.status !== 'physical',
    })
  } catch (e) {
    return serverError(e)
  }
}
