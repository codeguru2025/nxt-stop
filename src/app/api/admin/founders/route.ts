import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, error, forbidden, serverError } from '@/lib/api'

export async function GET() {
  try {
    const founders = await prisma.founder.findMany({
      where: { active: true },
      orderBy: { order: 'asc' },
    })
    return ok(founders)
  } catch (e) {
    return serverError(e)
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()

    const { name, role, bio, image, order } = await req.json()
    if (!name) return error('Name is required')

    const founder = await prisma.founder.create({
      data: { name, role, bio, image, order: order ?? 0 },
    })

    return ok(founder, 201)
  } catch (e) {
    return serverError(e)
  }
}
