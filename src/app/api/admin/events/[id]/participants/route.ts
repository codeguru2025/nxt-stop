import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireCapability } from '@/lib/auth'
import { ok, error, forbidden, serverError } from '@/lib/api'
import { normalizeWhatsAppPhone } from '@/lib/phone'
import bcrypt from 'bcryptjs'
import { createAccountWithOneTimePassword, generateOneTimePassword, splitName } from '@/lib/onboarding'
import { sendWelcomeEmail } from '@/lib/email'
import { sendLineupSms } from '@/lib/sms'
import { writeAuditLog } from '@/lib/auditLog'
import { getReferralPercent } from '@/lib/referralRate'
import { canIssuePassword, hasOwnPassword } from '@/lib/participantPasswords'

// Line-up members (DJs, MCs, acts) marked as participants of an event. Each gets an
// account — made here if they don't have one — so they have a share link without ever
// buying a ticket. Links pay the same flat % as everyone's, so no approval is needed.

const participantSelect = {
  id: true, name: true, role: true, createdAt: true,
  user: {
    select: {
      id: true, name: true, phone: true, email: true, referralCode: true, mustResetPassword: true,
      passwordSetAt: true, role: true, _count: { select: { orders: true, tickets: true } },
    },
  },
} as const

type ParticipantRow = {
  id: string; name: string; role: string; createdAt: Date
  user: {
    id: string; name: string; phone: string; email: string | null; referralCode: string; mustResetPassword: boolean
    passwordSetAt: Date | null; role: string; _count: { orders: number; tickets: number }
  }
}

function shape(p: ParticipantRow) {
  const u = p.user
  return {
    id: p.id, name: p.name, role: p.role, createdAt: p.createdAt,
    user: {
      id: u.id, name: u.name, phone: u.phone, email: u.email, referralCode: u.referralCode, mustResetPassword: u.mustResetPassword,
      hasOwnPassword: hasOwnPassword(u), canIssuePassword: canIssuePassword(u),
    },
  }
}

// GET /api/admin/events/:id/participants
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireCapability('events').catch(() => null)
    if (!session) return forbidden()
    const { id } = await ctx.params

    const [participants, referralPercent] = await Promise.all([
      prisma.eventParticipant.findMany({ where: { eventId: id }, orderBy: { createdAt: 'asc' }, select: participantSelect }),
      getReferralPercent(),
    ])
    return ok({ participants: participants.map(shape), referralPercent })
  } catch (e) {
    return serverError(e)
  }
}

// PATCH /api/admin/events/:id/participants — { participantId } issues a new one-time
// password (the old one stops working), emails it if possible, and returns it once.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireCapability('events').catch(() => null)
    if (!session) return forbidden()
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const participantId = typeof body.participantId === 'string' ? body.participantId : ''
    if (!participantId) return error('participantId is required')

    const p = await prisma.eventParticipant.findFirst({
      where: { id: participantId, eventId: id },
      select: { ...participantSelect, event: { select: { name: true } } },
    })
    if (!p) return error('Participant not found', 404)
    if (!canIssuePassword(p.user)) {
      return error(hasOwnPassword(p.user)
        ? 'They already have their own password. They can use “Forgot password?” on the login page.'
        : 'This account has purchases, so its password can’t be reset from here. They can use “Forgot password?” on the login page.', 409)
    }

    const oneTimePassword = generateOneTimePassword()
    await prisma.user.update({
      where: { id: p.user.id },
      data: { passwordHash: await bcrypt.hash(oneTimePassword, 10), mustResetPassword: true, oneTimePasswordUsedAt: null },
    })
    if (p.user.email) {
      sendWelcomeEmail(p.user.id, oneTimePassword).catch(err => console.error(`Welcome email failed for participant ${p.user.id}`, err))
    }
    sendLineupSms(p.user.id, p.event.name, oneTimePassword).catch(err => console.error(`Line-up SMS failed for participant ${p.user.id}`, err))
    writeAuditLog({
      actorId: session.id, actorRole: session.role, req,
      action: 'event.participant.new-password', entityType: 'EventParticipant', entityId: p.id,
      after: { name: p.name, eventName: p.event.name, userId: p.user.id, emailed: !!p.user.email },
    })
    return ok({ oneTimePassword, emailed: !!p.user.email })
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
    if (oneTimePassword) {
      sendLineupSms(participant.user.id, event.name, oneTimePassword).catch(err => {
        console.error(`Line-up SMS failed for participant ${participant.user.id}`, err)
      })
    }

    writeAuditLog({
      actorId: session.id, actorRole: session.role, req,
      action: 'event.participant.add', entityType: 'EventParticipant', entityId: participant.id,
      after: { name, role, eventName: event.name, userId: participant.user.id, newAccount: !!oneTimePassword },
    })

    // The one-time password is returned once so the admin can pass it on (e.g. by
    // WhatsApp) when there's no email; the account must change it on first login.
    return ok({ participant: shape(participant), oneTimePassword }, 201)
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
