import { prisma } from '@/lib/db'
import { ok, error, serverError } from '@/lib/api'
import { checkAuthLimit } from '@/lib/rateLimit'
import { normalizeWhatsAppPhone } from '@/lib/phone'
import { issueCode } from '@/lib/smsCodes'
import { sendLoginCodeSms, smsEnabled } from '@/lib/sms'

// Staff sign in with their password only: a code by SMS is as strong as the SIM it goes to
const CODE_LOGIN_ROLES = ['customer', 'partner']

// POST /api/auth/login-code/request — { phone }
// Texts a 6-digit sign-in code. Answers the same whether or not the number has an
// account, so it can't be used to find out who is registered.
export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    const { limited, retryAfter } = await checkAuthLimit(ip)
    if (limited) return error(`Too many attempts. Try again in ${retryAfter}s`, 429)
    if (!smsEnabled()) return error('Sign-in by SMS code is not available right now — use your password', 503)

    const body = await req.json().catch(() => ({}))
    const typed = String(body?.phone ?? '').trim()
    const phone = normalizeWhatsAppPhone(typed)
    if (!phone) return error('Enter a valid phone number')

    const generic = ok({ message: 'If that number has an account, a code is on its way.' })
    const user = await prisma.user.findFirst({
      where: { phone: { in: phone !== typed ? [typed, phone] : [phone] } },
      select: { id: true, role: true },
    })
    if (!user || !CODE_LOGIN_ROLES.includes(user.role)) return generic

    const issued = await issueCode('login', phone, user.id)
    if (!issued.ok) return error('Too many codes sent to this number. Wait 15 minutes and try again.', 429)
    await sendLoginCodeSms(phone, issued.code)
    return generic
  } catch (e) {
    return serverError(e)
  }
}
