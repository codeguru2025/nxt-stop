import { prisma } from '@/lib/db'
import { ok, serverError } from '@/lib/api'

export async function GET() {
  try {
    const teasers = await prisma.eventMedia.findMany({
      where: { type: 'teaser', event: { status: { in: ['published', 'live'] } } },
      orderBy: { createdAt: 'desc' },
      include: {
        event: { select: { name: true, date: true, slug: true } },
      },
    })
    return ok(teasers)
  } catch (e) {
    return serverError(e)
  }
}
