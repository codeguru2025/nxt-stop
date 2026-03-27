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

    const reward = await prisma.reward.findUnique({ where: { id: rewardId, active: true } })
    if (!reward) return error('Reward not found')

    const user = await prisma.user.findUnique({ where: { id: session.id } })
    if (!user) return unauthorized()

    if (user.points < reward.pointsCost) {
      return error(`Insufficient points. You need ${reward.pointsCost} but have ${user.points}`)
    }

    if (reward.stock !== null && reward.stock <= 0) {
      return error('Reward is out of stock')
    }

    // Deduct points and create redemption
    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.id },
        data: { points: { decrement: reward.pointsCost } },
      }),
      prisma.redemption.create({
        data: {
          userId: session.id,
          rewardId,
          points: reward.pointsCost,
          status: 'pending',
        },
      }),
      ...(reward.stock !== null
        ? [prisma.reward.update({ where: { id: rewardId }, data: { stock: { decrement: 1 } } })]
        : []),
    ])

    return ok({ message: 'Reward redeemed successfully' }, 201)
  } catch (e) {
    return serverError(e)
  }
}
