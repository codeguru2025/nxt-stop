import { prisma } from '@/lib/db'
import { requireAuth, signToken } from '@/lib/auth'
import { ok, error, unauthorized, serverError } from '@/lib/api'
import { generateOrderNumber } from '@/lib/qr'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { z } from 'zod'

const CreateOrderSchema = z.object({
  eventId:      z.string().min(1),
  ticketTypeId: z.string().min(1),
  quantity:     z.number().int().min(1).max(20).default(1),
  referralCode: z.string().optional(),
  partnerId:    z.string().optional(),
  guestEmail:   z.string().email().optional(),
  guestName:    z.string().min(1).max(100).optional(),
  recipientName: z.string().max(100).optional(),
})

export async function POST(req: Request) {
  try {
    const session = await requireAuth().catch(() => null)

    const body = await req.json()
    const parsed = CreateOrderSchema.safeParse(body)
    if (!parsed.success) {
      return error(parsed.error.issues.map(i => i.message).join('; '))
    }
    const { eventId, ticketTypeId, quantity, referralCode, partnerId, guestEmail, guestName, recipientName } = parsed.data

    // Resolve user — either from session or guest checkout
    let userId: string
    let guestToken: string | undefined
    let autoSessionToken: string | undefined

    if (session) {
      userId = session.id
    } else {
      if (!guestEmail) return error('Email is required to purchase tickets')
      if (!guestName)  return error('Name is required to purchase tickets')

      // Upsert to prevent TOCTOU race between two concurrent guest checkouts with same email
      const fakeHash = await bcrypt.hash(crypto.randomUUID(), 6)
      const guestUser = await prisma.user.upsert({
        where:  { email: guestEmail },
        update: {},
        create: {
          email: guestEmail,
          name: guestName,
          passwordHash: fakeHash,
          role: 'customer',
        },
      })

      userId = guestUser.id
      guestToken = crypto.randomUUID()

      autoSessionToken = await signToken({
        id: guestUser.id,
        email: guestUser.email,
        name: guestUser.name,
        role: guestUser.role,
        referralCode: guestUser.referralCode,
      })
    }

    // Capacity check + order creation inside a transaction to prevent overselling
    const result = await prisma.$transaction(async (tx) => {
      const ticketType = await tx.ticketType.findFirst({
        where: { id: ticketTypeId, eventId, active: true },
        include: { event: true },
      })

      if (!ticketType) throw Object.assign(new Error('Ticket type not found'), { status: 404 })
      if (!ticketType.active) throw Object.assign(new Error('Ticket type is no longer available'), { status: 409 })
      if (ticketType.sold + quantity > ticketType.capacity) {
        throw Object.assign(new Error('Not enough tickets available'), { status: 409 })
      }

      const platformFee = ticketType.event.platformFee * quantity
      const subtotal = ticketType.price * quantity
      const total = subtotal + platformFee

      let resolvedPartnerId = partnerId
      if (!resolvedPartnerId && referralCode) {
        const partner = await tx.partner.findUnique({ where: { referralCode } })
        resolvedPartnerId = partner?.id
      }

      const order = await tx.order.create({
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

      return { order, ticketType, event: ticketType.event }
    })

    return ok({
      order: result.order,
      ticketType: result.ticketType,
      event: result.event,
      guestToken: guestToken ?? null,
      autoSessionToken: autoSessionToken ?? null,
    }, 201)
  } catch (e: any) {
    if (e?.status === 404 || e?.status === 409) return error(e.message, e.status)
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
