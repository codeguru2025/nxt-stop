import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { ok, error, unauthorized, serverError } from '@/lib/api'
import { checkAuthLimit } from '@/lib/rateLimit'
import { normalizeWhatsAppPhone } from '@/lib/phone'
import { issueCode } from '@/lib/smsCodes'
import { sendPhoneChangeCode, smsAvailable } from '@/lib/sms'

// POST /api/dashboard/phone/request — { phone }
// First step of changing your number: a code goes to the NEW number, proving you have it.
// SMS only, with no email fallback: an emailed code would prove who is asking but not that
// the new number is theirs, and the number is their login.
export async function POST(req: Request) {
  try {
    const session = await requireAuth().catch(() => null)
    if (!session) return unauthorized()
    const { limited, retryAfter } = await checkAuthLimit(`phone-change:${session.id}`)
    if (limited) return error(`Too many attempts. Try again in ${retryAfter}s`, 429)

    const body = await req.json().catch(() => ({}))
    const phone = normalizeWhatsAppPhone(String(body?.phone ?? ''))
    if (!phone) return error('Enter a valid phone number in international format')

    const me = await prisma.user.findUnique({ where: { id: session.id }, select: { phone: true } })
    if (!me) return unauthorized()
    if (me.phone === phone) return error('That is already your number')
    const taken = await prisma.user.findFirst({ where: { phone, id: { not: session.id } }, select: { id: true } })
    if (taken) return error('That number already has an NXT STOP account')
    if (!(await smsAvailable('auth.phone-change-code', 'otp'))) {
      return error('Changing your number needs a code texted to the new number, and we can’t send SMS right now. Please try again later.', 503)
    }

    const issued = await issueCode('phone-change', phone, session.id)
    if (!issued.ok) return error('Too many codes sent to that number. Wait 15 minutes and try again.', 429)
    const result = await sendPhoneChangeCode(phone, issued.code)
    if (result !== 'sent') return error('We could not text a code to that number. Check it and try again.', 502)
    return ok({ via: 'sms', message: `Code texted to ${phone}` })
  } catch (e) {
    return serverError(e)
  }
}
