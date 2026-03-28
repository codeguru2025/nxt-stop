import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, error, forbidden, serverError } from '@/lib/api'

export async function GET(req: Request) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()

    const url = new URL(req.url)
    const eventId  = url.searchParams.get('eventId')
    const category = url.searchParams.get('category')

    const products = await prisma.product.findMany({
      where: {
        ...(eventId  ? { eventId }  : {}),
        ...(category ? { category } : {}),
      },
      orderBy: { sold: 'desc' },
      include: { event: { select: { name: true } } },
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

    const {
      eventId, name, description, price, stock, category,
      image, lowStockAt, merchType, size, color,
    } = await req.json()

    if (!eventId || !name || price === undefined || stock === undefined) {
      return error('eventId, name, price, and stock are required')
    }

    const product = await prisma.product.create({
      data: {
        eventId, name, description, price, stock,
        category:  category  ?? 'drink',
        image,
        lowStockAt: lowStockAt ?? 10,
        merchType:  merchType  ?? null,
        size:       size       ?? null,
        color:      color      ?? null,
      },
    })

    return ok(product, 201)
  } catch (e) {
    return serverError(e)
  }
}
