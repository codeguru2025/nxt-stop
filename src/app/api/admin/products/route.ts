import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, error, forbidden, serverError } from '@/lib/api'

export async function GET(req: Request) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()

    const url = new URL(req.url)
    const eventId = url.searchParams.get('eventId')

    const products = await prisma.product.findMany({
      where: eventId ? { eventId } : undefined,
      orderBy: { sold: 'desc' },
      include: {
        event: { select: { name: true } },
      },
    })

    return ok(products)
  } catch (e) {
    return serverError(e)
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()

    const { eventId, name, description, price, stock, category, image, lowStockAt } = await req.json()

    if (!eventId || !name || price === undefined || stock === undefined) {
      return error('eventId, name, price, and stock are required')
    }

    const product = await prisma.product.create({
      data: {
        eventId, name, description, price, stock,
        category: category ?? 'drink',
        image,
        lowStockAt: lowStockAt ?? 10,
      },
    })

    return ok(product, 201)
  } catch (e) {
    return serverError(e)
  }
}
