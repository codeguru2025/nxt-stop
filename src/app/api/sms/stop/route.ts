import { prisma } from '@/lib/db'
import { ok, error, serverError } from '@/lib/api'
import { checkAuthLimit } from '@/lib/rateLimit'
import { normalizeWhatsAppPhone } from '@/lib/phone'

// POST /api/sms/stop — { phone }
// Public opt-out from promotional SMS, linked from every promotional message. No login:
// opting out is harmless, so it only needs the number. Same answer whether or not the
// number has an account.
export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    const { limited, retryAfter } = await checkAuthLimit(`sms-stop:${ip}`)
    if (limited) return error(`Too many attempts. Try again in ${retryAfter}s`, 429)

    const body = await req.json().catch(() => ({}))
    const typed = String(body?.phone ?? '').trim()
    const phone = normalizeWhatsAppPhone(typed)
    if (!phone) return error('Enter the phone number the messages come to')

    await prisma.user.updateMany({
      where: { phone: { in: phone !== typed ? [typed, phone] : [phone] }, smsOptOutAt: null },
      data: { smsOptOutAt: new Date() },
    })
    return ok({ message: 'Done — you will not get promotional SMS from NXT STOP any more. You will still get messages about your own tickets and payments.' })
  } catch (e) {
    return serverError(e)
  }
}
