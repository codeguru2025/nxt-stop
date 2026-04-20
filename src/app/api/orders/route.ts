import { prisma } from '@/lib/db'
import { requireAuth, signToken } from '@/lib/auth'
import { ok, error, unauthorized, serverError } from '@/lib/api'
import { generateOrderNumber } from '@/lib/qr'
import { checkOrderLimit } from '@/lib/rateLimit'
import { normalizeWhatsAppPhone } from '@/lib/phone'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { z } from 'zod'

function getIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
}

const CreateOrderSchema = z.object({
  eventId:      z.string().min(1),
  ticketTypeId: z.string().min(1),
  quantity:     z.number().int().min(1).max(20).default(1),
  referralCode: z.string().optional(),
  partnerId:    z.string().optional(),
  whatsappPhone: z.string().min(7).max(30),
  whatsappName: z.string().min(1).max(100),
  guestPhone:   z.string().min(7).max(20).optional(),
  guestName:    z.string().min(1).max(100).optional(),
  recipientName: z.string().max(100).optional(),
})

export async function POST(req: Request) {
  try {
    const session = await requireAuth().catch(() => null)

    // Rate limit: keyed by session userId for logged-in users, by IP for guests
    const rlKey = session ? `user:${session.id}` : `ip:${getIp(req)}`
    const { limited } = await checkOrderLimit(rlKey)
    if (limited) return error('Too many orders — please wait before trying again', 429)

    const body = await req.json()
    const parsed = CreateOrderSchema.safeParse(body)
    if (!parsed.success) {
      return error(parsed.error.issues.map((i: { message: string }) => i.message).join('; '))
    }
    const { eventId, ticketTypeId, quantity, referralCode, partnerId, guestPhone, guestName, recipientName, whatsappPhone, whatsappName } = parsed.data

    const normalizedWhatsappPhone = normalizeWhatsAppPhone(whatsappPhone ?? guestPhone ?? '')
    if (!normalizedWhatsappPhone) return error('Enter a valid WhatsApp number in international format')
    const normalizedWhatsappName = (whatsappName ?? guestName ?? '').trim()
    if (!normalizedWhatsappName) return error('WhatsApp name is required')

    // Resolve user — either from session or guest checkout
    let userId: string
    let guestToken: string | undefined
    let autoSessionToken: string | undefined

    if (session) {
      userId = session.id
    } else {
      if (!guestPhone && !whatsappPhone) return error('Phone number is required to purchase tickets')
      if (!guestName && !whatsappName)  return error('Name is required to purchase tickets')

      // Check if a user with a real password already exists — require them to log in
      const existingUser = await prisma.user.findUnique({ where: { phone: normalizedWhatsappPhone } })
      if (existingUser) {
        return error('This phone number is already registered. Please log in to purchase tickets.', 401)
      }

      const fakeHash = await bcrypt.hash(crypto.randomUUID(), 6)
      const guestUser = await prisma.user.create({
        data: {
          phone: normalizedWhatsappPhone,
          name: normalizedWhatsappName,
          passwordHash: fakeHash,
          role: 'customer',
        },
      })

      userId = guestUser.id
      guestToken = crypto.randomUUID()

      autoSessionToken = await signToken({
        id: guestUser.id,
        phone: guestUser.phone,
        name: guestUser.name,
        role: guestUser.role,
        referralCode: guestUser.referralCode,
      })
    }

    // Expire stale pending orders (older than 30 min) before checking capacity.
    // This is best-effort cleanup so abandoned carts don't permanently block inventory.
    const PENDING_TTL_MS = 30 * 60 * 1000
    await prisma.order.updateMany({
      where: { status: 'pending', createdAt: { lt: new Date(Date.now() - PENDING_TTL_MS) } },
      data: { status: 'failed' },
    }).catch(() => {})

    // Capacity check + order creation inside a transaction to prevent overselling
    const result = await prisma.$transaction(async (tx) => {
      // Lock the TicketType row for the duration of this transaction.
      // This serialises concurrent checkouts for the same ticket type so that
      // the aggregate-then-insert below is atomic — no two requests can both
      // read reserved=0 and both proceed past the capacity check.
      await tx.$executeRaw`SELECT id FROM "TicketType" WHERE id = ${ticketTypeId} FOR UPDATE`

      const ticketType = await tx.ticketType.findFirst({
        where: { id: ticketTypeId, eventId, active: true },
        include: { event: true },
      })

      if (!ticketType) throw Object.assign(new Error('Ticket type not found'), { status: 404 })
      if (!ticketType.active) throw Object.assign(new Error('Ticket type is no longer available'), { status: 409 })
      if (['ended', 'cancelled'].includes(ticketType.event.status)) {
        throw Object.assign(new Error('Ticket sales for this event are closed'), { status: 409 })
      }

      // Count pending (unpaid) orders that have already reserved this ticket type
      // so concurrent checkouts don't jointly exceed capacity
      const pendingReserved = await tx.orderItem.aggregate({
        where: { ticketTypeId, order: { status: 'pending' } },
        _sum: { quantity: true },
      })
      const reserved = pendingReserved._sum.quantity ?? 0

      if (ticketType.sold + reserved + quantity > ticketType.capacity) {
        throw Object.assign(new Error('Not enough tickets available'), { status: 409 })
      }

      const platformFee = Number(ticketType.event.platformFee) * quantity
      const subtotal = Number(ticketType.price) * quantity
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
          guestPhone: session ? null : normalizedWhatsappPhone,
          guestName: session ? null : normalizedWhatsappName,
          whatsappPhone: normalizedWhatsappPhone,
          whatsappName: normalizedWhatsappName,
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

    if (autoSessionToken) {
      const cookieStore = await cookies()
      cookieStore.set('nxt-session', autoSessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      })
    }

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
