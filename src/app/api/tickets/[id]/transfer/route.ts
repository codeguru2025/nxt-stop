import crypto from 'crypto'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { ok, error, unauthorized, serverError } from '@/lib/api'
import { normalizeWhatsAppPhone } from '@/lib/phone'
import { createAccountWithOneTimePassword, splitName } from '@/lib/onboarding'
import { writeAuditLog } from '@/lib/auditLog'
import { eventEndTime } from '@/lib/utils'
import { sendTicketTransferNotice, smsAvailable } from '@/lib/sms'

const TransferSchema = z.object({
  phone: z.string().trim().min(1, 'Enter their phone number').max(30),
  name: z.string().trim().max(100).optional(),
  // Only used for a new account: how they sign in when SMS can't reach them
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(200).optional().or(z.literal('')),
})

// POST /api/tickets/:id/transfer — { phone, name?, email? }
// Gives one of your valid tickets to someone else. They get it on their account (made
// for them if they have none — they sign in with a one-time code) and a new QR code, so a
// screenshot of the old one no longer gets in.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth().catch(() => null)
    if (!session) return unauthorized()
    const { id } = await ctx.params

    const parsed = TransferSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return error(parsed.error.issues.map(i => i.message).join('; '))
    const typed = parsed.data.phone
    const phone = normalizeWhatsAppPhone(typed)
    if (!phone) return error('Enter a valid phone number in international format')

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: {
        id: true, userId: true, status: true, ticketNumber: true,
        event: { select: { name: true, date: true, endDate: true } },
      },
    })
    if (!ticket || ticket.userId !== session.id) return error('Ticket not found', 404)
    if (ticket.status !== 'valid') return error(`Only valid tickets can be transferred (this one is ${ticket.status})`)
    if (eventEndTime(ticket.event.date, ticket.event.endDate) <= new Date()) return error('This event is over')

    const existing = await prisma.user.findFirst({
      where: { phone: { in: phone !== typed ? [typed, phone] : [phone] } },
      select: { id: true, phone: true, email: true },
    })
    if (existing?.id === session.id) return error('That is your own number')
    // A new account signs in with a one-time code, sent by SMS or else to its email — so
    // without SMS it needs an email address, or they could never get in
    const newEmail = existing ? null : parsed.data.email || null
    if (!existing && !newEmail && !(await smsAvailable('ticket.transfer'))) {
      return error('That number has no NXT STOP account yet, and we can’t text them right now. Add their email address so they can sign in.', 400)
    }

    const recipient = await prisma.$transaction(async (tx) => {
      let to = existing
      if (!to) {
        const { firstName, lastName } = splitName(parsed.data.name || 'NXT STOP Guest')
        const { user } = await createAccountWithOneTimePassword({ phone, firstName, lastName, email: newEmail }, tx)
        to = { id: user.id, phone: user.phone, email: user.email }
      }
      // Guarded on owner and status so a double-tap can't move it twice
      const { count } = await tx.ticket.updateMany({
        where: { id: ticket.id, userId: session.id, status: 'valid' },
        data: { userId: to.id, qrCode: crypto.randomUUID() },
      })
      if (count !== 1) throw new Error('TICKET_CHANGED')
      return to
    }).catch((e: unknown) => {
      if (e instanceof Error && e.message === 'TICKET_CHANGED') return null
      throw e
    })
    if (!recipient) return error('This ticket changed while you were transferring it — refresh and try again', 409)

    writeAuditLog({
      actorId: session.id, actorRole: session.role, req,
      action: 'ticket.transferred', entityType: 'Ticket', entityId: ticket.id,
      after: { ticketNumber: ticket.ticketNumber, eventName: ticket.event.name, toUserId: recipient.id, toPhone: recipient.phone, newAccount: !existing },
    })
    const via = await sendTicketTransferNotice({
      toPhone: recipient.phone, toEmail: recipient.email, senderName: session.name, eventName: ticket.event.name,
      eventDate: ticket.event.date, ticketNumber: ticket.ticketNumber,
    })

    const told = via === 'sms' ? 'We let them know by SMS.'
      : via === 'email' ? 'We let them know by email.'
      : 'We couldn’t notify them, so tell them it’s waiting in their NXT STOP account.'
    return ok({ via, message: `Ticket sent to ${recipient.phone}. ${told}` })
  } catch (e) {
    return serverError(e)
  }
}
