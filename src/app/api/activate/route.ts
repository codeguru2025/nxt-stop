import { prisma } from '@/lib/db'
import { requireGateOrAdmin } from '@/lib/auth'
import { ok, error, unauthorized, serverError } from '@/lib/api'
import { generateOrderNumber } from '@/lib/qr'
import { normalizeWhatsAppPhone } from '@/lib/phone'
import { createAccountWithOneTimePassword, splitName } from '@/lib/onboarding'
import { sendWelcomeEmail } from '@/lib/email'
import { writeAuditLog } from '@/lib/auditLog'
import { z } from 'zod'

const activateSchema = z.object({
  activationCode: z.string().trim().min(1, 'Activation code is required'),
  buyerPhone:     z.string().trim().min(1, "Buyer's phone number is required"),
  buyerName:      z.string().trim().min(1, "Buyer's name is required").max(100),
  // Optional at the sales desk — many cash buyers don't have one. Without it the
  // account is claimed later through the admin-assisted phone reset.
  buyerEmail:     z.string().trim().toLowerCase().email('Enter a valid email or leave it blank').max(200).optional().or(z.literal('')),
})

// POST /api/activate — activate a physical ticket when it is sold for cash
// Requires gate_staff or admin auth.
// Body: { activationCode, buyerPhone, buyerName, buyerEmail? }
//
// No one buys without an account: the ticket and cash order are moved from the admin
// who printed the batch to the buyer's account — found by phone, or created here with
// a one-time password (emailed when an email is given). The paper ticket and the one
// in their account are the same ticket, so its QR still only scans once.
export async function POST(req: Request) {
  try {
    const session = await requireGateOrAdmin().catch(() => null)
    if (!session) return unauthorized()

    const parsed = activateSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return error(parsed.error.issues.map(i => i.message).join('; '))
    const { activationCode, buyerName } = parsed.data
    const buyerEmail = parsed.data.buyerEmail || undefined

    const buyerPhone = normalizeWhatsAppPhone(parsed.data.buyerPhone)
    if (!buyerPhone) return error('Enter a valid phone number, e.g. 0771234567 or +263771234567')

    const clean = activationCode.trim().toUpperCase()
    if (clean.length > 20) return error('Invalid activation code')

    // Look up ticket details first (read-only, outside transaction)
    const ticket = await prisma.ticket.findUnique({
      where: { activationCode: clean },
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

    // Wrap all mutations in a transaction. The atomic updateMany with WHERE status='physical'
    // is the idempotency guard — if two requests race, only one gets count=1.
    const orderNumber = generateOrderNumber()
    let newAccount: { userId: string; plaintextPassword: string } | undefined
    const result = await prisma.$transaction(async (tx) => {
      // Atomically claim the ticket — only succeeds if it's still 'physical'
      const { count } = await tx.ticket.updateMany({
        where: { id: ticket.id, status: 'physical' },
        data: { status: 'valid', activatedAt: new Date(), activatedById: session.id },
      })
      if (count === 0) throw Object.assign(new Error('Ticket is already activated and sold'), { status: 409 })

      // Find the buyer's account by phone, or create one. Created inside the transaction
      // so a failed/raced activation never leaves an orphan account behind.
      let buyer = await tx.user.findUnique({ where: { phone: buyerPhone }, select: { id: true, name: true } })
      const accountCreated = !buyer
      if (!buyer) {
        const { firstName, lastName } = splitName(buyerName)
        const created = await createAccountWithOneTimePassword(
          { phone: buyerPhone, firstName, lastName, email: buyerEmail },
          tx
        )
        buyer = { id: created.user.id, name: created.user.name }
        newAccount = { userId: created.user.id, plaintextPassword: created.plaintextPassword }
      }

      // Create the cash sale order
      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: buyer.id,
          whatsappPhone: buyerPhone,
          whatsappName: buyerName,
          email: buyerEmail ?? null,
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

      // Hand the ticket to the buyer, link it to the order, and count the sale
      await tx.ticket.update({ where: { id: ticket.id }, data: { orderId: order.id, userId: buyer.id } })
      await tx.ticketType.update({ where: { id: ticket.ticketTypeId }, data: { sold: { increment: 1 } } })

      return { order, buyer, accountCreated }
    })

    if (newAccount && buyerEmail) {
      const { userId, plaintextPassword } = newAccount
      sendWelcomeEmail(userId, plaintextPassword).catch((err) => {
        console.error(`Welcome email failed for user ${userId}`, err)
      })
    }

    writeAuditLog({
      actorId: session.id,
      actorRole: session.role,
      action: 'ticket.physical.activate',
      entityType: 'Ticket',
      entityId: ticket.id,
      after: {
        orderNumber: result.order.orderNumber,
        buyerId: result.buyer.id,
        accountCreated: result.accountCreated,
        emailProvided: !!buyerEmail,
      },
      req,
    })

    return ok({
      orderNumber: result.order.orderNumber,
      buyer: {
        name: result.buyer.name,
        phone: buyerPhone,
        accountCreated: result.accountCreated,
        passwordEmailed: result.accountCreated && !!buyerEmail,
      },
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
  } catch (e: any) {
    if (e?.status === 409) return error(e.message, 409)
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
