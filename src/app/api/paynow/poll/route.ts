import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { ok, error, unauthorized, serverError } from '@/lib/api'
import { pollPaynowTransaction } from '@/lib/paynow'
import { fulfillOrder } from '@/lib/fulfillOrder'
import { checkPollLimit } from '@/lib/rateLimit'

function getIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
}

// GET /api/paynow/poll?orderId=xxx&guestToken=xxx
export async function GET(req: Request) {
  try {
    const session = await requireAuth().catch(() => null)
    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('orderId')
    const guestToken = searchParams.get('guestToken')

    if (!orderId) return error('orderId is required')

    // Rate limit: keyed by session userId for logged-in users, by IP for guests
    const rlKey = session ? `user:${session.id}` : `ip:${getIp(req)}`
    const { limited } = await checkPollLimit(rlKey)
    if (limited) return error('Too many poll requests — please slow down', 429)

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
      try {
        await fulfillOrder(orderId, order.paymentMethod ?? 'paynow', order.paymentRef)
      } catch (fulfillErr) {
        console.error('fulfillOrder failed during poll — will retry on next poll', fulfillErr)
        return ok({ status: 'pending' })
      }
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
