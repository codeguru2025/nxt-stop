import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { ok, error, unauthorized, serverError } from '@/lib/api'
import { pollPaynowTransaction } from '@/lib/paynow'
import { fulfillOrder } from '@/lib/fulfillOrder'

// GET /api/paynow/poll?orderId=xxx&guestToken=xxx
export async function GET(req: Request) {
  try {
    const session = await requireAuth().catch(() => null)
    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('orderId')
    const guestToken = searchParams.get('guestToken')

    if (!orderId) return error('orderId is required')

    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order) return error('Order not found', 404)

    // Auth check
    if (session) {
      if (order.userId !== session.id) return error('Order not found', 404)
    } else if (guestToken) {
      if (order.guestToken !== guestToken) return error('Order not found', 404)
    } else {
      return unauthorized()
    }

    // Webhook may have already fulfilled the order — return immediately
    if (order.status === 'paid') return ok({ status: 'paid' })
    if (order.status === 'failed') return ok({ status: 'failed', message: 'Payment was declined or cancelled' })

    if (!order.paymentRef) return ok({ status: 'pending' })

    const txStatus = await pollPaynowTransaction(order.paymentRef)

    if (txStatus === 'paid') {
      await fulfillOrder(orderId, order.paymentMethod ?? 'paynow', order.paymentRef)
      return ok({ status: 'paid' })
    }

    if (txStatus === 'failed' || txStatus === 'cancelled') {
      await prisma.order.update({ where: { id: orderId }, data: { status: 'failed' } })
      return ok({ status: 'failed', message: 'Payment was declined or cancelled. Please try again.' })
    }

    return ok({ status: 'pending' })
  } catch (e) {
    return serverError(e)
  }
}
