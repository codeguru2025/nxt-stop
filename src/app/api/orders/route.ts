import { prisma } from '@/lib/db'
import { requireAuth, signToken } from '@/lib/auth'
import { ok, error, unauthorized, serverError } from '@/lib/api'
import { generateOrderNumber } from '@/lib/qr'
import { checkOrderLimit } from '@/lib/rateLimit'
import { normalizeWhatsAppPhone } from '@/lib/phone'
import { eventDayStartUtc, eventEndTime } from '@/lib/utils'
import { createAccountWithOneTimePassword, splitName } from '@/lib/onboarding'
import { sendWelcomeEmail } from '@/lib/email'
import { cookies } from 'next/headers'
import { REF_COOKIE } from '@/lib/visits'
import crypto from 'crypto'
import { z } from 'zod'

function getIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
}

const CreateOrderSchema = z.object({
  eventId:      z.string().min(1).optional(),
  ticketTypeId: z.string().min(1).optional(),
  // Pre-event purchases (beverage/liquor vouchers, merchandise, tables) — a single-line
  // order for a Product instead of a TicketType. Exactly one of ticketTypeId/productId
  // must be given.
  productId:    z.string().min(1).optional(),
  quantity:     z.number().int().min(1).max(20).default(1),
  referralCode: z.string().optional(),
  partnerId:    z.string().optional(),
  whatsappPhone: z.string().min(7).max(30),
  whatsappName: z.string().min(1).max(100),
  guestPhone:   z.string().min(7).max(20).optional(),
  guestName:    z.string().min(1).max(100).optional(),
  recipientName: z.string().max(100).optional(),
  email:        z.string().trim().toLowerCase().email().max(200).optional(),
  homeTown:     z.string().trim().max(100).optional(),
  isWhatsApp:   z.boolean().optional(),
}).refine((v) => !!v.ticketTypeId !== !!v.productId, {
  message: 'Provide exactly one of ticketTypeId or productId',
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
    const { eventId, ticketTypeId, productId, quantity, referralCode: referralCodeParam, partnerId, guestPhone, guestName, recipientName, whatsappPhone, whatsappName, email, homeTown, isWhatsApp } = parsed.data
    // A referral link clicked in the last 30 days still earns its owner credit even if the
    // buyer browsed elsewhere before checking out (cookie set by /r/CODE — see lib/visits.ts)
    const referralCode = referralCodeParam || (await cookies()).get(REF_COOKIE)?.value || undefined

    const normalizedWhatsappPhone = normalizeWhatsAppPhone(whatsappPhone ?? guestPhone ?? '')
    if (!normalizedWhatsappPhone) return error('Enter a valid WhatsApp number in international format')
    const normalizedWhatsappName = (whatsappName ?? guestName ?? '').trim()
    if (!normalizedWhatsappName) return error('WhatsApp name is required')

    // Resolve user — either from session or checkout-time account creation.
    // Profile creation is compulsory: an account with a system-issued one-time
    // password is always created for a first-time buyer (see lib/onboarding.ts).
    let userId: string
    let guestToken: string | undefined
    let autoSessionToken: string | undefined
    let newAccount: { userId: string; plaintextPassword: string } | undefined

    if (session) {
      userId = session.id
    } else {
      if (!guestPhone && !whatsappPhone) return error('Phone number is required to purchase tickets')
      if (!guestName && !whatsappName)  return error('Name is required to purchase tickets')
      if (!email) return error('Email is required — we use it to send your account password')

      // Check if a user with a real password already exists — require them to log in
      const existingUser = await prisma.user.findUnique({ where: { phone: normalizedWhatsappPhone } })
      if (existingUser) {
        return error('This phone number already has an NXT STOP account. Please log in to buy tickets.', 409, 'ACCOUNT_EXISTS')
      }

      const { firstName, lastName } = splitName(normalizedWhatsappName)
      const { user: guestUser, plaintextPassword } = await createAccountWithOneTimePassword({
        phone: normalizedWhatsappPhone,
        firstName,
        lastName,
        email,
        homeTown,
        isWhatsApp,
      })

      userId = guestUser.id
      guestToken = crypto.randomUUID()
      newAccount = { userId: guestUser.id, plaintextPassword }

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
      let resolvedPartnerId = partnerId
      if (!resolvedPartnerId && referralCode) {
        const partner = await tx.partner.findUnique({ where: { referralCode } })
        resolvedPartnerId = partner?.id
      }

      const orderBaseData = {
        orderNumber: generateOrderNumber(),
        userId,
        status: 'pending' as const,
        partnerId: resolvedPartnerId ?? null,
        referralCode: referralCode ?? null,
        guestToken: guestToken ?? null,
        guestPhone: session ? null : normalizedWhatsappPhone,
        guestName: session ? null : normalizedWhatsappName,
        whatsappPhone: normalizedWhatsappPhone,
        whatsappName: normalizedWhatsappName,
        recipientName: recipientName ?? null,
        email: email ?? null,
      }

      // ── Pre-event purchase: a Product (beverage/liquor voucher, merch, table) ──
      if (productId) {
        await tx.$executeRaw`SELECT id FROM "Product" WHERE id = ${productId} FOR UPDATE`

        const product = await tx.product.findFirst({
          where: { id: productId, active: true },
          include: { event: { select: { date: true, endDate: true, status: true } } },
        })
        if (!product) throw Object.assign(new Error('Product not found'), { status: 404 })
        // Event-linked items (drink vouchers, tables) stop selling when their event is over
        if (product.event && (
          ['ended', 'cancelled'].includes(product.event.status) ||
          new Date() > eventEndTime(product.event.date, product.event.endDate)
        )) {
          throw Object.assign(new Error('This event has ended — sales are closed'), { status: 409 })
        }

        const pendingReserved = await tx.orderItem.aggregate({
          where: { productId, order: { status: 'pending' } },
          _sum: { quantity: true },
        })
        const reserved = pendingReserved._sum.quantity ?? 0
        if (product.sold + reserved + quantity > product.stock) {
          throw Object.assign(new Error('Not enough stock available'), { status: 409 })
        }

        const subtotal = Number(product.price) * quantity
        const total = subtotal

        const order = await tx.order.create({
          data: {
            ...orderBaseData,
            subtotal,
            platformFees: 0,
            total,
            items: {
              create: {
                name: product.name,
                price: product.price,
                quantity,
                productId,
              },
            },
          },
          include: { items: true },
        })

        return { order, ticketType: null, product, event: null }
      }

      // ── Ticket purchase ──
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
      // Sales-window gate — independent of `active`. The ticket type stays visible in
      // the UI either way; this is the server-side source of truth that can't be bypassed.
      const dayStart = eventDayStartUtc(ticketType.event.date)
      if (ticketType.salesChannel === 'advance' && new Date() >= dayStart) {
        throw Object.assign(new Error('Advance sales have closed — this ticket is available at the gate on the day'), { status: 409 })
      }
      if (ticketType.salesChannel === 'gate' && new Date() < dayStart) {
        throw Object.assign(new Error('This ticket type goes on sale on the day of the event'), { status: 409 })
      }
      // Same end time the event page uses, so the page and the server agree on "ended"
      if (new Date() > eventEndTime(ticketType.event.date, ticketType.event.endDate)) {
        // Tag the error so we can auto-flag the event AFTER the tx rolls back
        throw Object.assign(new Error('This event has ended — ticket sales are closed'), { status: 409, autoEndEventId: eventId })
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

      const order = await tx.order.create({
        data: {
          ...orderBaseData,
          subtotal,
          platformFees: platformFee,
          total,
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

      return { order, ticketType, product: null, event: ticketType.event }
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

    if (newAccount) {
      sendWelcomeEmail(newAccount.userId, newAccount.plaintextPassword).catch((err) => {
        console.error(`Welcome email failed for user ${newAccount!.userId}`, err)
      })
    }

    return ok({
      order: result.order,
      ticketType: result.ticketType,
      product: result.product,
      event: result.event,
      guestToken: guestToken ?? null,
      autoSessionToken: autoSessionToken ?? null,
    }, 201)
  } catch (e: any) {
    // Auto-flag event as ended outside the rolled-back transaction
    if (e?.autoEndEventId) {
      prisma.event.updateMany({
        where: { id: e.autoEndEventId, status: { in: ['published', 'live'] } },
        data: { status: 'ended' },
      }).catch(() => {})
    }
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
