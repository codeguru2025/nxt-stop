import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { ok, error, unauthorized, serverError } from '@/lib/api'
import { buildUssdCode, buildUssdLink } from '@/lib/ecocash'
import { checkPollLimit } from '@/lib/rateLimit'
import { env } from '@/lib/env'
import { z } from 'zod'

function getIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
}

const InitiateSchema = z.object({
  orderId:    z.string().min(1),
  payerPhone: z.string().min(9).max(20),
  guestToken: z.string().uuid().optional(),
})

// POST /api/ecocash/initiate
// Direct EcoCash dial-to-pay: bypasses Paynow entirely. Returns a USSD tel: link the
// buyer's own phone dials to send money straight to ECOCASH_MERCHANT_NUMBER. Payment
// confirmation happens later and out of band, via /api/ecocash/sms-webhook.
export async function POST(req: Request) {
  try {
    const session = await requireAuth().catch(() => null)

    const body = await req.json()
    const parsed = InitiateSchema.safeParse(body)
    if (!parsed.success) return error(parsed.error.issues.map((i) => i.message).join('; '))

    const { orderId, payerPhone, guestToken } = parsed.data

    const rlKey = session ? `user:${session.id}` : `ip:${getIp(req)}`
    const { limited } = await checkPollLimit(rlKey)
    if (limited) return error('Too many requests. Please wait a moment and try again.', 429)

    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order) return error('Order not found', 404)

    if (session) {
      if (order.userId !== session.id) return error('Order not found', 404)
    } else if (guestToken) {
      if (order.guestToken !== guestToken) return error('Order not found', 404)
    } else {
      return unauthorized()
    }

    if (order.status !== 'pending') {
      const msgs: Record<string, string> = {
        paid:     'Order is already paid',
        failed:   'Order failed — please start a new order',
        refunded: 'Order has been refunded — please start a new order',
      }
      return error(msgs[order.status] ?? `Order cannot be paid (status: ${order.status})`)
    }

    const merchantNumber = env.ECOCASH_MERCHANT_NUMBER
    const amount = Number(order.total)
    const ussdCode = buildUssdCode(merchantNumber, amount)
    const ussdLink = buildUssdLink(ussdCode)

    await prisma.order.update({
      where: { id: orderId },
      data: { paymentMethod: 'ecocash', ecocashPayerPhone: payerPhone },
    })

    return ok({
      type: 'ecocash_direct',
      ussdCode,
      ussdLink,
      merchantNumber,
      amount,
      instructions: `Dial ${ussdCode} on ${payerPhone} and enter your EcoCash PIN to complete the $${amount.toFixed(2)} payment.`,
    })
  } catch (e) {
    return serverError(e)
  }
}
