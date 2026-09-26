import { prisma } from '@/lib/db'
import { ok, error, serverError } from '@/lib/api'
import { checkAuthLimit } from '@/lib/rateLimit'
import bcrypt from 'bcryptjs'
import { sendPasswordChangedSms } from '@/lib/sms'

// POST /api/auth/reset-password
// Public. Body: { token, newPassword }. Single-use, expiring token created by
// POST /api/auth/forgot-password.
export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    const { limited, retryAfter } = await checkAuthLimit(ip)
    if (limited) return error(`Too many attempts. Try again in ${retryAfter}s`, 429)

    const { token, newPassword } = await req.json().catch(() => ({}))
    if (!token || typeof token !== 'string') return error('Invalid or expired reset link')
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return error('New password must be at least 8 characters')
    }

    const record = await prisma.passwordResetToken.findUnique({ where: { token } })
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return error('Invalid or expired reset link', 400)
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash, mustResetPassword: false, passwordSetAt: new Date() },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ])
    sendPasswordChangedSms(record.userId).catch(err => console.error(`Password changed SMS failed for user ${record.userId}`, err))

    return ok({ message: 'Password reset — you can now sign in' })
  } catch (e) {
    return serverError(e)
  }
}
