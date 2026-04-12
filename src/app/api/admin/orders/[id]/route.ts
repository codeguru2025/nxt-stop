import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, forbidden, notFound, serverError } from '@/lib/api'

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()
    const { id } = await ctx.params

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        items: true,
        tickets: {
          select: {
            id: true,
            ticketNumber: true,
            status: true,
            createdAt: true,
            event: { select: { name: true, date: true } },
            ticketType: { select: { name: true, price: true } },
          },
        },
      },
    })
    if (!order) return notFound('Order')

    return ok(order)
  } catch (e) {
    return serverError(e)
  }
}
