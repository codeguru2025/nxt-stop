import { prisma } from '@/lib/db'
import { fulfillOrder } from '@/lib/fulfillOrder'

// POST /api/paynow/webhook
// Paynow posts status updates here (resultUrl).
// Body is URL-encoded: status, reference, amount, paynowreference, pollurl, hash
export async function POST(req: Request) {
  try {
    const body = await req.text()
    const params = new URLSearchParams(body)

    const status = params.get('status')?.toLowerCase()
    const reference = params.get('reference') // our orderNumber
    const paynowRef = params.get('paynowreference')

    if (!reference || !status) return new Response('Bad Request', { status: 400 })

    if (status === 'paid' || status === 'awaiting delivery') {
      const order = await prisma.order.findFirst({
        where: { orderNumber: reference },
      })
      if (order && order.status !== 'paid') {
        await fulfillOrder(order.id, order.paymentMethod ?? 'paynow', paynowRef ?? undefined)
      }
    } else if (status === 'cancelled' || status === 'failed') {
      await prisma.order.updateMany({
        where: { orderNumber: reference, status: 'pending' },
        data: { status: 'failed' },
      })
    }

    return new Response('OK', { status: 200 })
  } catch (e) {
    console.error('Paynow webhook error', e)
    return new Response('Error', { status: 500 })
  }
}
