import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, error, forbidden, serverError } from '@/lib/api'
import { fulfillOrder } from '@/lib/fulfillOrder'
import { pollPaynowTransaction } from '@/lib/paynow'

// GET /api/admin/orders?search=&status=&page=
export async function GET(req: Request) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') ?? ''
    const status = searchParams.get('status') ?? ''
    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = 50

    const where: any = {}
    if (status) where.status = status
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { guestEmail: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { name: true, email: true } },
          items: true,
          tickets: { select: { id: true, ticketNumber: true, status: true } },
        },
      }),
      prisma.order.count({ where }),
    ])

    return ok({ orders, total, pages: Math.ceil(total / limit) })
  } catch (e) {
    return serverError(e)
  }
}

// POST /api/admin/orders — manual fulfill or re-check
// Body: { orderId, action: 'fulfill' | 'check' | 'cancel' }
export async function POST(req: Request) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()

    const { orderId, action } = await req.json()
    if (!orderId || !action) return error('orderId and action required')

    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order) return error('Order not found', 404)

    if (action === 'fulfill') {
      // Manually fulfill — used when webhook failed but user did pay
      await fulfillOrder(orderId, order.paymentMethod ?? 'manual', order.paymentRef ?? undefined)
      return ok({ message: 'Order fulfilled — tickets generated' })
    }

    if (action === 'check') {
      // Re-poll Paynow for latest status
      if (!order.paymentRef) return error('No poll URL on record')
      const txStatus = await pollPaynowTransaction(order.paymentRef)
      if (txStatus === 'paid' && order.status !== 'paid') {
        await fulfillOrder(orderId, order.paymentMethod ?? 'paynow', order.paymentRef)
        return ok({ txStatus, message: 'Payment confirmed — tickets generated' })
      }
      return ok({ txStatus, message: `Paynow status: ${txStatus}` })
    }

    if (action === 'cancel') {
      await prisma.order.update({ where: { id: orderId }, data: { status: 'failed' } })
      return ok({ message: 'Order marked as failed' })
    }

    return error('Unknown action')
  } catch (e) {
    return serverError(e)
  }
}
