import { prisma } from '@/lib/db'
import { ok, serverError } from '@/lib/api'

// Public endpoint — returns all active merchandise products
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const eventId   = url.searchParams.get('eventId')
    const merchType = url.searchParams.get('type')

    const products = await prisma.product.findMany({
      where: {
        category: 'merchandise',
        active: true,
        ...(eventId   ? { eventId }             : {}),
        ...(merchType ? { merchType }            : {}),
      },
      orderBy: [{ merchType: 'asc' }, { price: 'asc' }],
      include: { event: { select: { id: true, name: true, date: true, slug: true } } },
    })

    const res = ok(products)
    res.headers.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300')
    return res
  } catch (e) {
    return serverError(e)
  }
}
