import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { ok, error, unauthorized, serverError } from '@/lib/api'
import { generateOrderNumber } from '@/lib/qr'

export async function POST(req: Request) {
  try {
    const session = await requireAuth().catch(() => null)
    if (!session) return unauthorized()

    const { eventId, ticketTypeId, quantity = 1, referralCode, partnerId } = await req.json()

    if (!eventId || !ticketTypeId) {
      return error('eventId and ticketTypeId are required')
    }

    const ticketType = await prisma.ticketType.findFirst({
      where: { id: ticketTypeId, eventId, active: true },
      include: { event: true },
    })

    if (!ticketType) return error('Ticket type not found')
    if (ticketType.sold + quantity > ticketType.capacity) {
      return error('Not enough tickets available')
    }

    const platformFee = ticketType.event.platformFee * quantity
    const subtotal = ticketType.price * quantity
    const total = subtotal + platformFee

    let resolvedPartnerId = partnerId
    if (!resolvedPartnerId && referralCode) {
      const partner = await prisma.partner.findUnique({ where: { referralCode } })
      resolvedPartnerId = partner?.id
    }

    // Create a pending order — no tickets yet, fulfilled after payment confirmation
    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: session.id,
        subtotal,
        platformFees: platformFee,
        total,
        status: 'pending',
        partnerId: resolvedPartnerId ?? null,
        referralCode: referralCode ?? null,
        items: {
          create: {
            name: `${ticketType.name} - ${ticketType.event.name}`,
            price: ticketType.price,
            quantity,
          },
        },
      },
      include: { items: true },
    })

    return ok({ order, ticketType, event: ticketType.event }, 201)
  } catch (e) {
    return serverError(e)
  }
}

export async function GET(req: Request) {
  try {
    const session = await requireAuth().catch(() => null)
    if (!session) return unauthorized()

    const orders = await prisma.order.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        tickets: {
          include: {
            event: { select: { name: true, date: true, venue: true, posterImage: true } },
            ticketType: { select: { name: true, color: true } },
          },
        },
      },
    })

    return ok(orders)
  } catch (e) {
    return serverError(e)
  }
}
