import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { ok, unauthorized, serverError } from '@/lib/api'

// GET /api/dashboard/referrals — the logged-in user's own referral list + reward totals
export async function GET() {
  try {
    const session = await requireAuth().catch(() => null)
    if (!session) return unauthorized()

    const referrals = await prisma.referral.findMany({
      where: { sourceUserId: session.id },
      orderBy: { createdAt: 'desc' },
      include: {
        target: { select: { name: true } },
        reward: { select: { amount: true, status: true, paidAt: true } },
      },
    })

    const totals = referrals.reduce(
      (acc, r) => {
        if (!r.reward) return acc
        const amount = Number(r.reward.amount)
        if (r.reward.status === 'paid') acc.paid += amount
        else if (r.reward.status === 'pending') acc.pending += amount
        return acc
      },
      { pending: 0, paid: 0 }
    )

    return ok({
      referrals: referrals.map((r) => ({
        id: r.id,
        targetName: r.target.name,
        pointsAwarded: r.pointsAwarded,
        reward: r.reward ? { amount: Number(r.reward.amount), status: r.reward.status, paidAt: r.reward.paidAt } : null,
        createdAt: r.createdAt,
      })),
      totals,
    })
  } catch (e) {
    return serverError(e)
  }
}
