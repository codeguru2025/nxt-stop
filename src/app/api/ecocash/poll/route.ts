import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { ok, error, unauthorized, serverError } from '@/lib/api'
import { checkPollLimit } from '@/lib/rateLimit'

function getIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
}

// GET /api/ecocash/poll?orderId=xxx&guestToken=xxx
// No external API to poll — the order is marked paid asynchronously by
// /api/ecocash/sms-webhook (or a manual admin fulfill). This just reflects that status.
export async function GET(req: Request) {
  try {
    const session = await requireAuth().catch(() => null)
    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('orderId')
    const guestToken = searchParams.get('guestToken')

    if (!orderId) return error('orderId is required')

    const rlKey = session ? `user:${session.id}` : `ip:${getIp(req)}`
    const { limited } = await checkPollLimit(rlKey)
    if (limited) return error('Too many poll requests — please slow down', 429)

    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order) return error('Order not found', 404)

    if (session) {
      if (order.userId !== session.id) return error('Order not found', 404)
    } else if (guestToken) {
      if (order.guestToken !== guestToken) return error('Order not found', 404)
    } else {
      return unauthorized()
    }

    if (order.status === 'paid') return ok({ status: 'paid' })
    if (order.status === 'failed') return ok({ status: 'failed', message: 'Payment was declined or cancelled' })

    return ok({ status: 'pending' })
  } catch (e) {
    return serverError(e)
  }
}
