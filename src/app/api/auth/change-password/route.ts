import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { ok, error, unauthorized, serverError } from '@/lib/api'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  try {
    const session = await requireAuth().catch(() => null)
    if (!session) return unauthorized()

    const { currentPassword, newPassword } = await req.json()

    if (!currentPassword || !newPassword) {
      return error('Current password and new password are required')
    }
    if (newPassword.length < 8) {
      return error('New password must be at least 8 characters')
    }
    if (currentPassword === newPassword) {
      return error('New password must be different from current password')
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { passwordHash: true },
    })
    if (!user) return unauthorized()

    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) return error('Current password is incorrect', 401)

    const passwordHash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: session.id }, data: { passwordHash } })

    return ok({ message: 'Password changed successfully' })
  } catch (e) {
    return serverError(e)
  }
}
