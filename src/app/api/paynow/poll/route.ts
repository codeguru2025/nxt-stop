import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { ok, error, unauthorized, serverError } from '@/lib/api'
import { pollPaynowTransaction } from '@/lib/paynow'
import { fulfillOrder } from '@/lib/fulfillOrder'

// GET /api/paynow/poll?orderId=xxx
export async function GET(req: Request) {
  try {
    const session = await requireAuth().catch(() => null)
    if (!session) return unauthorized()

    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('orderId')
    if (!orderId) return error('orderId is required')

    const order = await prisma.order.findUnique({
      where: { id: orderId, userId: session.id },
    })

    if (!order) return error('Order not found', 404)

    // Already fulfilled
    if (order.status === 'paid') return ok({ status: 'paid' })

    if (!order.paymentRef) return error('No poll URL on record — initiate payment first')

    const paid = await pollPaynowTransaction(order.paymentRef)

    if (paid) {
      await fulfillOrder(orderId, order.paymentMethod ?? 'paynow', order.paymentRef)
      return ok({ status: 'paid' })
    }

    return ok({ status: 'pending' })
  } catch (e) {
    return serverError(e)
  }
}
