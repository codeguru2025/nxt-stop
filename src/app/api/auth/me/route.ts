import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ok, unauthorized, serverError } from '@/lib/api'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return unauthorized()

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        referralCode: true,
        points: true,
        totalEarned: true,
        avatar: true,
        createdAt: true,
        _count: {
          select: {
            tickets: true,
            referralsMade: true,
            redemptions: true,
          },
        },
      },
    })

    if (!user) return unauthorized()
    return ok(user)
  } catch (e) {
    return serverError(e)
  }
}
