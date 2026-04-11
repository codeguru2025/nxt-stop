import { prisma } from '@/lib/db'
import { fulfillOrder } from '@/lib/fulfillOrder'
import { createHash } from 'crypto'

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
    const receivedHash = params.get('hash')

    if (!reference || !status || !receivedHash) return new Response('Bad Request', { status: 400 })

    // Verify Paynow hash: SHA512 of status+reference+amount+paynowreference+pollurl+integrationKey(lower) (uppercase)
    // PayNow uses SHA512 (same algorithm as the paynow npm library's generateHash function)
    const integrationKey = process.env.PAYNOW_INTEGRATION_KEY
    if (!integrationKey) {
      console.error('PAYNOW_INTEGRATION_KEY not set — rejecting webhook')
      return new Response('Server Error', { status: 500 })
    }

    const hashInput = [
      params.get('status') ?? '',
      params.get('reference') ?? '',
      params.get('amount') ?? '',
      params.get('paynowreference') ?? '',
      params.get('pollurl') ?? '',
    ].join('') + integrationKey.toLowerCase()

    const computedHash = createHash('sha512').update(hashInput).digest('hex').toUpperCase()

    if (computedHash !== receivedHash.toUpperCase()) {
      console.warn('Paynow webhook hash mismatch — possible spoofing attempt')
      return new Response('Forbidden', { status: 403 })
    }

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
