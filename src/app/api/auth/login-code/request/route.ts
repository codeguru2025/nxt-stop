import { prisma } from '@/lib/db'
import { ok, error, serverError } from '@/lib/api'
import { checkAuthLimit } from '@/lib/rateLimit'
import { normalizeWhatsAppPhone } from '@/lib/phone'
import { issueCode } from '@/lib/smsCodes'
import { sendLoginCode, smsAvailable } from '@/lib/sms'
import { emailEnabled, maskEmail } from '@/lib/email'

// Staff sign in with their password only: a code by SMS is as strong as the SIM it goes to
const CODE_LOGIN_ROLES = ['customer', 'partner']

// POST /api/auth/login-code/request — { phone }
// Sends a 6-digit sign-in code by SMS, or by email when SMS can't go (switched off, no
// credits). Answers the same whether or not the number has an account, so it can't be
// used to find out who is registered. `via` tells the screen where to look.
export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    const { limited, retryAfter } = await checkAuthLimit(ip)
    if (limited) return error(`Too many attempts. Try again in ${retryAfter}s`, 429)

    // Decided before looking the number up, so the answer can't depend on the account
    const bySms = await smsAvailable('auth.login-code', 'otp')
    if (!bySms && !emailEnabled()) return error('Sign-in with a code is not available right now — use your password', 503)

    const body = await req.json().catch(() => ({}))
    const typed = String(body?.phone ?? '').trim()
    const phone = normalizeWhatsAppPhone(typed)
    if (!phone) return error('Enter a valid phone number')

    const generic = bySms
      ? ok({ via: 'sms', message: 'If that number has an account, we have texted a code to it.' })
      : ok({ via: 'email', message: 'We can’t send codes by SMS right now. If that number has an account with an email address, we have emailed the code there — check your inbox and spam folder.' })
    const user = await prisma.user.findFirst({
      where: { phone: { in: phone !== typed ? [typed, phone] : [phone] } },
      select: { id: true, role: true, email: true },
    })
    if (!user || !CODE_LOGIN_ROLES.includes(user.role)) return generic

    const issued = await issueCode('login', phone, user.id)
    if (!issued.ok) return error('Too many codes sent to this number. Wait 15 minutes and try again.', 429)
    const via = await sendLoginCode(phone, user.email, issued.code)
    // Only reached when the SMS gateway refused a send it should have taken — rare, and not
    // something a caller can trigger to probe for accounts
    if (bySms && via === 'email') {
      return ok({ via: 'email', message: `We couldn’t text you, so we emailed the code to ${maskEmail(user.email!)} instead.` })
    }
    if (bySms && via === null) return error('We couldn’t send you a code just now — sign in with your password or try again shortly', 502)
    return generic
  } catch (e) {
    return serverError(e)
  }
}
