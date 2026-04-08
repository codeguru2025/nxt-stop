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

        const user = await tx.user.findUnique({ where: { id: session.id } })
        if (!user) throw Object.assign(new Error('User not found'), { status: 401 })
        if (user.points < reward.pointsCost) {
          throw Object.assign(
            new Error(`Insufficient points. You need ${reward.pointsCost} but have ${user.points}`),
            { status: 400 }
          )
        }

        await tx.user.update({ where: { id: session.id }, data: { points: { decrement: reward.pointsCost } } })
        await tx.redemption.create({
          data: { userId: session.id, rewardId, points: reward.pointsCost, status: 'pending' },
        })
        if (reward.stock !== null) {
          await tx.reward.update({ where: { id: rewardId }, data: { stock: { decrement: 1 } } })
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
