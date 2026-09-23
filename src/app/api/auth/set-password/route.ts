import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { ok, error, unauthorized, serverError } from '@/lib/api'
import bcrypt from 'bcryptjs'

// POST /api/auth/set-password
// The ONLY route in the app that can clear User.mustResetPassword. Used both for the
// forced first-login reset (system-issued one-time password) and can be called any
// time after that as a plain "set a new password" action.
export async function POST(req: Request) {
  try {
    const session = await requireAuth().catch(() => null)
    if (!session) return unauthorized()

    const { newPassword } = await req.json().catch(() => ({}))
    if (!newPassword || typeof newPassword !== 'string') {
      return error('New password is required')
    }
    if (newPassword.length < 8) return error('New password must be at least 8 characters')

    const passwordHash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: session.id },
      data: { passwordHash, mustResetPassword: false, passwordSetAt: new Date() },
    })

    return ok({ message: 'Password set successfully' })
  } catch (e) {
    return serverError(e)
  }
}
