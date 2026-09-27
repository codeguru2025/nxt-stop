import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, error, forbidden, serverError } from '@/lib/api'
import { writeAuditLog } from '@/lib/auditLog'
import { checkSmsCreditAlert, smsCredits, SMS_LOW_CREDITS } from '@/lib/smsCredits'
import { env } from '@/lib/env'
import { isPlatformCreator } from '@/lib/platformCreator'
import { AUTO_SMS, setSmsSwitchedOff, smsSwitchedOff } from '@/lib/smsSettings'
import { emailEnabled } from '@/lib/email'
import { OTP_RESERVE, ordersOwedPaymentSms, sendMissedOrderPaidSms } from '@/lib/sms'

// Texts ticket buyers still owed a payment confirmation, now that SMS can go (in the
// background — a large backlog takes a while; the hourly run picks up whatever's left)
function catchUpPaymentSms() {
  sendMissedOrderPaidSms()
    .then(n => { if (n > 0) console.log(`[sms] caught up ${n} payment confirmation SMS`) })
    .catch(err => console.error('[sms] payment confirmation catch-up failed', err))
}

// GET /api/admin/sms — SMS credits bought and left, recent top-ups and messages, and which
// automatic SMS are switched on. Every admin can see it; only the platform creator can add
// credits (POST) or switch messages on and off (PATCH).
export async function GET() {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()
    const canAddCredits = await isPlatformCreator(session.id)

    const weekStart = new Date(Date.now() - 7 * 24 * 3600e3)
    try {
      const [credits, topUps, messages, week, switchedOff, owed] = await Promise.all([
        smsCredits(),
        prisma.smsTopUp.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
        prisma.smsMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
        prisma.smsMessage.groupBy({ by: ['status'], where: { createdAt: { gte: weekStart } }, _count: { id: true } }),
        smsSwitchedOff(),
        ordersOwedPaymentSms(),
      ])
      const count = (status: string) => week.find(r => r.status === status)?._count.id ?? 0
      return ok({
        ready: true,
        enabled: !!env.SMS_PROVIDER,
        emailEnabled: emailEnabled(),
        canAddCredits,
        autoSms: AUTO_SMS.map(m => ({ ...m, on: !switchedOff.has(m.key) })),
        otpReserve: OTP_RESERVE,
        owedPaymentSms: owed.length,
        lowThreshold: SMS_LOW_CREDITS,
        credits,
        week: { sent: count('sent'), failed: count('failed'), noCredit: count('no_credit'), emailed: count('emailed') },
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
    if (credits > 0) catchUpPaymentSms()

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

// PATCH /api/admin/sms { switchedOff: string[] } — the automatic SMS to switch off (all others
// on). Switched-off messages go by email instead. Platform creator only, like credits.
export async function PATCH(req: Request) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()
    if (!(await isPlatformCreator(session.id))) return forbidden()

    const body = await req.json().catch(() => ({}))
    if (!Array.isArray(body?.switchedOff) || body.switchedOff.some((k: unknown) => typeof k !== 'string')) {
      return error('switchedOff must be a list of message keys')
    }
    const before = [...await smsSwitchedOff()].sort()
    const switchedOff = await setSmsSwitchedOff(body.switchedOff)
    if (before.includes('order.paid') && !switchedOff.includes('order.paid')) catchUpPaymentSms()

    writeAuditLog({
      actorId: session.id, actorRole: session.role,
      action: 'sms.switches.update', entityType: 'Setting', entityId: 'sms.switchedOff',
      before: { switchedOff: before }, after: { switchedOff }, req,
    })
    return ok({ switchedOff })
  } catch (e) {
    return serverError(e)
  }
}
