import { prisma } from '@/lib/db'
import { requireCapability } from '@/lib/auth'
import { ok, forbidden, serverError } from '@/lib/api'

// GET /api/admin/referral-rewards?status=pending
export async function GET(req: Request) {
  try {
    const session = await requireCapability('referrals').catch(() => null)
    if (!session) return forbidden()

    const url = new URL(req.url)
    const status = url.searchParams.get('status') ?? undefined

    const rewards = await prisma.referralReward.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        referral: { select: { id: true, targetUserId: true } },
      },
    })

    return ok(rewards)
  } catch (e) {
    return serverError(e)
  }
}
