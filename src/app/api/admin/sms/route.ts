import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, error, forbidden, serverError } from '@/lib/api'
import { writeAuditLog } from '@/lib/auditLog'
import { checkSmsCreditAlert, smsCredits, SMS_LOW_CREDITS } from '@/lib/smsCredits'
import { env } from '@/lib/env'
import { isPlatformCreator } from '@/lib/platformCreator'

// GET /api/admin/sms — SMS credits bought and left, recent top-ups and messages.
// Every admin can see it; only the platform creator can add credits (POST).
export async function GET() {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()
    const canAddCredits = await isPlatformCreator(session.id)

    const weekStart = new Date(Date.now() - 7 * 24 * 3600e3)
    try {
      const [credits, topUps, messages, week] = await Promise.all([
        smsCredits(),
        prisma.smsTopUp.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
        prisma.smsMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
        prisma.smsMessage.groupBy({ by: ['status'], where: { createdAt: { gte: weekStart } }, _count: { id: true } }),
      ])
      const count = (status: string) => week.find(r => r.status === status)?._count.id ?? 0
      return ok({
        ready: true,
        enabled: !!env.SMS_PROVIDER,
        canAddCredits,
        lowThreshold: SMS_LOW_CREDITS,
        credits,
        week: { sent: count('sent'), failed: count('failed'), noCredit: count('no_credit') },
        topUps,
        messages,
      })
    } catch (err) {
      // SMS tables missing — the sms_credits migration hasn't been run on this database yet
      console.error('[sms] admin summary unavailable', err)
      return ok({ ready: false, enabled: !!env.SMS_PROVIDER, canAddCredits })
    }
  } catch (e) {
    return serverError(e)
  }
}

// POST /api/admin/sms { credits, note } — record SMS bought from the gateway. Platform
// creator only (not owners), re-checked from the DB. A negative amount corrects a mistake (note required).
export async function POST(req: Request) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()
    if (!(await isPlatformCreator(session.id))) return forbidden()
    const me = await prisma.user.findUnique({ where: { id: session.id }, select: { name: true } })
    if (!me) return forbidden()

    const body = await req.json().catch(() => ({}))
    const credits = Number(body?.credits)
    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 200) : ''
    if (!Number.isInteger(credits) || credits === 0 || Math.abs(credits) > 1_000_000) {
      return error('Enter a whole number of SMS credits (up to 1,000,000)')
    }
    if (credits < 0 && !note) return error('Say why when taking credits off')

    const topUp = await prisma.smsTopUp.create({
      data: { credits, note: note || null, addedById: session.id, addedByName: me.name },
    })
    const { remaining } = await smsCredits()
    await checkSmsCreditAlert(remaining) // clears a low/empty alert so the next drop alerts again

    writeAuditLog({
      actorId: session.id, actorRole: session.role,
      action: 'sms.credits.add', entityType: 'SmsTopUp', entityId: topUp.id,
      after: { credits, note: note || null, remaining }, req,
    })
    return ok({ topUp, remaining }, 201)
  } catch (e) {
    return serverError(e)
  }
}
