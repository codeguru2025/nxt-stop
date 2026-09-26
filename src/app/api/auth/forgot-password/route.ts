import { prisma } from '@/lib/db'
import { ok, error, serverError } from '@/lib/api'
import { checkAuthLimit } from '@/lib/rateLimit'
import { sendPasswordResetEmail } from '@/lib/email'
import { sendPasswordResetSms } from '@/lib/sms'
import crypto from 'crypto'

const TOKEN_TTL_MS = 30 * 60 * 1000

// POST /api/auth/forgot-password
// Public, email-based, self-service. Always returns the same generic response
// regardless of whether the email matches an account (prevents enumeration).
export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    const { limited, retryAfter } = await checkAuthLimit(ip)
    if (limited) return error(`Too many attempts. Try again in ${retryAfter}s`, 429)

    const body = await req.json().catch(() => ({}))
    const email = String(body?.email ?? '').trim().toLowerCase()

    const generic = ok({ message: 'If an account exists for that email, a reset link has been sent.' })
    if (!email || email.length > 200) return generic

    const user = await prisma.user.findFirst({ where: { email }, select: { id: true } })
    if (!user) return generic

    const token = crypto.randomBytes(32).toString('hex')
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
    })

    sendPasswordResetEmail(user.id, token).catch((err) => {
      console.error(`Password reset email failed for user ${user.id}`, err)
    })
    sendPasswordResetSms(user.id, token, TOKEN_TTL_MS / 60_000).catch((err) => {
      console.error(`Password reset SMS failed for user ${user.id}`, err)
    })

    return generic
  } catch (e) {
    return serverError(e)
  }
}
