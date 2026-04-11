import { prisma } from '@/lib/db'
import { ok, serverError } from '@/lib/api'

export async function GET() {
  try {
    const founders = await prisma.founder.findMany({
      where: { active: true },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, role: true, bio: true, image: true },
    })

    const res = ok(founders)
    res.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    return res
  } catch (e) {
    return serverError(e)
  }
}
