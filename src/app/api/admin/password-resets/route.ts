import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, forbidden, serverError } from '@/lib/api'

// GET /api/admin/password-resets — pending password reset requests
export async function GET() {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()

    const requests = await prisma.passwordResetRequest.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true, name: true, phone: true, role: true, createdAt: true,
            _count: { select: { tickets: true, orders: true } },
          },
        },
      },
    })

    return ok(requests)
  } catch (e) {
    return serverError(e)
  }
}
