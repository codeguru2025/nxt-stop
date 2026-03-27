import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, error, forbidden, serverError } from '@/lib/api'

export async function GET() {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()

    const rewards = await prisma.reward.findMany({
      orderBy: { pointsCost: 'asc' },
      include: { _count: { select: { redemptions: true } } },
    })

    return ok(rewards)
  } catch (e) {
    return serverError(e)
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()

    const { name, description, type, pointsCost, stock, image } = await req.json()

    if (!name || !type || pointsCost === undefined) {
      return error('name, type, and pointsCost are required')
    }

    const reward = await prisma.reward.create({
      data: { name, description, type, pointsCost, stock, image },
    })

    return ok(reward, 201)
  } catch (e) {
    return serverError(e)
  }
}
