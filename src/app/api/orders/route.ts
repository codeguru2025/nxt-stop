import { prisma } from '@/lib/db'
import { requireAuth, signToken } from '@/lib/auth'
import { ok, error, unauthorized, serverError } from '@/lib/api'
import { generateOrderNumber } from '@/lib/qr'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export async function POST(req: Request) {
  try {
    const session = await requireAuth().catch(() => null)

    const {
      eventId, ticketTypeId, quantity = 1, referralCode, partnerId,
      guestEmail, guestName, recipientName,
    } = await req.json()

    if (!eventId || !ticketTypeId) {
      return error('eventId and ticketTypeId are required')
    }

    // Resolve user — either from session or guest checkout
    let userId: string
    let guestToken: string | undefined
    let autoSessionToken: string | undefined

    if (session) {
      userId = session.id
    } else {
      if (!guestEmail) return error('Email is required to purchase tickets')
      if (!guestName)  return error('Name is required to purchase tickets')

      // Find or create the guest user
      let guestUser = await prisma.user.findUnique({ where: { email: guestEmail } })
      if (!guestUser) {
        const fakeHash = await bcrypt.hash(crypto.randomUUID(), 6)
        guestUser = await prisma.user.create({
          data: {
            email: guestEmail,
            name: guestName,
            passwordHash: fakeHash,
            role: 'customer',
          },
        })
      }
      userId = guestUser.id
      guestToken = crypto.randomUUID()

      // Auto-sign a session so client can be logged in after payment
      autoSessionToken = await signToken({
        id: guestUser.id,
        email: guestUser.email,
        name: guestUser.name,
        role: guestUser.role,
        referralCode: guestUser.referralCode,
      })
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

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId,
        subtotal,
        platformFees: platformFee,
        total,
        status: 'pending',
        partnerId: resolvedPartnerId ?? null,
        referralCode: referralCode ?? null,
        guestToken: guestToken ?? null,
        guestEmail: guestEmail ?? null,
        guestName: guestName ?? null,
        recipientName: recipientName ?? null,
        items: {
          create: {
            name: `${ticketType.name} - ${ticketType.event.name}`,
            price: ticketType.price,
            quantity,
            ticketTypeId,
          },
        },
      },
      include: { items: true },
    })

    return ok({
      order,
      ticketType,
      event: ticketType.event,
      guestToken: guestToken ?? null,
      autoSessionToken: autoSessionToken ?? null,
    }, 201)
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
