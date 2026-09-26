import crypto from 'crypto'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { ok, error, unauthorized, serverError } from '@/lib/api'
import { normalizeWhatsAppPhone } from '@/lib/phone'
import { createAccountWithOneTimePassword, splitName } from '@/lib/onboarding'
import { writeAuditLog } from '@/lib/auditLog'
import { eventEndTime } from '@/lib/utils'
import { sendTicketTransferSms, smsEnabled } from '@/lib/sms'

const TransferSchema = z.object({
  phone: z.string().trim().min(1, 'Enter their phone number').max(30),
  name: z.string().trim().max(100).optional(),
})

// POST /api/tickets/:id/transfer — { phone, name? }
// Gives one of your valid tickets to someone else. They get it on their account (made
// for them if they have none — they sign in with an SMS code) and a new QR code, so a
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
      select: { id: true, phone: true },
    })
    if (existing?.id === session.id) return error('That is your own number')
    // A new account can only be reached by SMS code (no password, no email), so SMS must work
    if (!existing && !smsEnabled()) return error('That number has no NXT STOP account yet. Ask them to buy or sign up first.')

    const recipient = await prisma.$transaction(async (tx) => {
      let to = existing
      if (!to) {
        const { firstName, lastName } = splitName(parsed.data.name || 'NXT STOP Guest')
        const { user } = await createAccountWithOneTimePassword({ phone, firstName, lastName }, tx)
        to = { id: user.id, phone: user.phone }
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
    sendTicketTransferSms({
      toPhone: recipient.phone, senderName: session.name, eventName: ticket.event.name,
      eventDate: ticket.event.date, ticketNumber: ticket.ticketNumber,
    }).catch(err => console.error(`Ticket transfer SMS failed for ${ticket.ticketNumber}`, err))

    return ok({ message: `Ticket sent to ${recipient.phone}` })
  } catch (e) {
    return serverError(e)
  }
}
