import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireCapability } from '@/lib/auth'
import { ok, error, forbidden, serverError } from '@/lib/api'
import { normalizeWhatsAppPhone } from '@/lib/phone'
import { createAccountWithOneTimePassword, splitName } from '@/lib/onboarding'
import { sendWelcomeEmail } from '@/lib/email'
import { writeAuditLog } from '@/lib/auditLog'

// Line-up members (DJs, MCs, acts) marked as participants of an event. Each gets an
// account — made here if they don't have one — so they have a share link without ever
// buying a ticket. Links pay the same flat % as everyone's, so no approval is needed.

const participantSelect = {
  id: true, name: true, role: true, createdAt: true,
  user: { select: { id: true, name: true, phone: true, email: true, referralCode: true, mustResetPassword: true } },
} as const

// GET /api/admin/events/:id/participants
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireCapability('events').catch(() => null)
    if (!session) return forbidden()
    const { id } = await ctx.params

    const participants = await prisma.eventParticipant.findMany({
      where: { eventId: id },
      orderBy: { createdAt: 'asc' },
      select: participantSelect,
    })
    return ok(participants)
  } catch (e) {
    return serverError(e)
  }
}

const AddSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  role: z.string().trim().min(1).max(40),
  phone: z.string().trim().min(1, 'Phone number is required').max(30),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(200).optional().or(z.literal('')),
})

// POST /api/admin/events/:id/participants — { name, role, phone, email? }
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireCapability('events').catch(() => null)
    if (!session) return forbidden()
    const { id } = await ctx.params

    const parsed = AddSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return error(parsed.error.issues.map(i => i.message).join('; '))
    const { name, role, email } = parsed.data

    const event = await prisma.event.findUnique({ where: { id }, select: { id: true, name: true } })
    if (!event) return error('Event not found', 404)

    const typed = parsed.data.phone
    const phone = normalizeWhatsAppPhone(typed)
    if (!phone) return error('Enter a valid phone number in international format')

    const existing = await prisma.user.findFirst({
      where: { phone: { in: phone !== typed ? [typed, phone] : [phone] } },
      select: { id: true },
    })
    if (existing) {
      const already = await prisma.eventParticipant.findUnique({
        where: { eventId_userId: { eventId: id, userId: existing.id } },
        select: { id: true },
      })
      if (already) return error('This person already has a share link for this event')
    }

    const { participant, oneTimePassword } = await prisma.$transaction(async (tx) => {
      let userId = existing?.id
      let oneTimePassword: string | null = null
      if (!userId) {
        const { firstName, lastName } = splitName(name)
        const created = await createAccountWithOneTimePassword({ phone, firstName, lastName, email: email || null }, tx)
        userId = created.user.id
        oneTimePassword = created.plaintextPassword
      }
      const participant = await tx.eventParticipant.create({
        data: { eventId: id, userId, name, role },
        select: participantSelect,
      })
      return { participant, oneTimePassword }
    })

    if (oneTimePassword && email) {
      sendWelcomeEmail(participant.user.id, oneTimePassword).catch(err => {
        console.error(`Welcome email failed for participant ${participant.user.id}`, err)
      })
    }

    writeAuditLog({
      actorId: session.id, actorRole: session.role, req,
      action: 'event.participant.add', entityType: 'EventParticipant', entityId: participant.id,
      after: { name, role, eventName: event.name, userId: participant.user.id, newAccount: !!oneTimePassword },
    })

    // The one-time password is returned once so the admin can pass it on (e.g. by
    // WhatsApp) when there's no email; the account must change it on first login.
    return ok({ participant, oneTimePassword }, 201)
  } catch (e) {
    // Two admins adding the same phone at once: the unique phone / (event, user) keys win
    if ((e as { code?: string })?.code === 'P2002') {
      return error('That phone number was just added — refresh to see it', 409)
    }
    return serverError(e)
  }
}

// DELETE /api/admin/events/:id/participants?participantId=… — the account itself stays
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireCapability('events').catch(() => null)
    if (!session) return forbidden()
    const { id } = await ctx.params
    const participantId = new URL(req.url).searchParams.get('participantId')
    if (!participantId) return error('participantId is required')

    const p = await prisma.eventParticipant.findFirst({
      where: { id: participantId, eventId: id },
      select: { id: true, name: true, userId: true, event: { select: { name: true } } },
    })
    if (!p) return error('Participant not found', 404)

    await prisma.eventParticipant.delete({ where: { id: p.id } })
    writeAuditLog({
      actorId: session.id, actorRole: session.role, req,
      action: 'event.participant.remove', entityType: 'EventParticipant', entityId: p.id,
      before: { name: p.name, eventName: p.event.name, userId: p.userId },
    })
    return ok({ id: p.id })
  } catch (e) {
    return serverError(e)
  }
}
