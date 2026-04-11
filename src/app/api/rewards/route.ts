import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { ok, error, unauthorized, serverError } from '@/lib/api'

export async function GET() {
  try {
    const rewards = await prisma.reward.findMany({
      where: { active: true },
      orderBy: { pointsCost: 'asc' },
    })
    return ok(rewards)
  } catch (e) {
    return serverError(e)
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth().catch(() => null)
    if (!session) return unauthorized()

    const { rewardId } = await req.json()
    if (!rewardId) return error('rewardId is required')

    // All validation + mutation inside a single interactive transaction to prevent
    // race conditions where two concurrent requests both pass the stock/points checks.
    try {
      await prisma.$transaction(async (tx) => {
        const reward = await tx.reward.findUnique({ where: { id: rewardId } })
        if (!reward) throw Object.assign(new Error('Reward not found'), { status: 404 })
        if (!reward.active) throw Object.assign(new Error('Reward is no longer available'), { status: 410 })
        if (reward.stock !== null && reward.stock <= 0) {
          throw Object.assign(new Error('Reward is out of stock'), { status: 409 })
        }

        // Atomic point deduction — only succeeds if user has enough points
        const deducted = await tx.user.updateMany({
          where: { id: session.id, points: { gte: reward.pointsCost } },
          data: { points: { decrement: reward.pointsCost } },
        })
        if (deducted.count === 0) {
          throw Object.assign(new Error('Insufficient points'), { status: 400 })
        }

        await tx.redemption.create({
          data: { userId: session.id, rewardId, points: reward.pointsCost, status: 'pending' },
        })
        if (reward.stock !== null) {
          const stockResult = await tx.reward.updateMany({
            where: { id: rewardId, stock: { gt: 0 } },
            data: { stock: { decrement: 1 } },
          })
          if (stockResult.count === 0) {
            throw Object.assign(new Error('Reward just went out of stock'), { status: 409 })
          }
        }
      })
    } catch (e: any) {
      if (e?.status) return error(e.message, e.status)
      throw e
    }

    return ok({ message: 'Reward redeemed successfully' }, 201)
  } catch (e) {
    return serverError(e)
  }
}
