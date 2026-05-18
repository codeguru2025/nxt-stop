import { prisma } from '@/lib/db'
import { ok, error, serverError } from '@/lib/api'
import { checkAuthLimit } from '@/lib/rateLimit'

// POST /api/auth/request-password-reset
// Public endpoint. Creates a pending PasswordResetRequest if the phone matches a user.
// Always returns the same generic success response to prevent phone-number enumeration.
export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    const { limited, retryAfter } = await checkAuthLimit(ip)
    if (limited) return error(`Too many attempts. Try again in ${retryAfter}s`, 429)

    const body = await req.json().catch(() => ({}))
    const phone = String(body?.phone ?? '').trim()
    const reason = body?.reason ? String(body.reason).slice(0, 280) : null

    // Generic response we always return (prevents enumeration)
    const generic = ok({
      message: 'If an account exists for that number, an admin will reach out to verify and reset it.',
    })

    if (!phone || phone.length > 20) return generic

    const user = await prisma.user.findUnique({ where: { phone }, select: { id: true } })
    if (!user) return generic

    // Throttle: only allow one open request per user at a time. If one exists, leave it.
    const existing = await prisma.passwordResetRequest.findFirst({
      where: { userId: user.id, status: 'pending' },
      select: { id: true },
    })
    if (!existing) {
      await prisma.passwordResetRequest.create({
        data: { userId: user.id, reason, ip },
      })
    }

    return generic
  } catch (e) {
    return serverError(e)
  }
}
