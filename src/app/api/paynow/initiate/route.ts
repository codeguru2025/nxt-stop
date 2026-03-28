import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { ok, error, unauthorized, serverError } from '@/lib/api'
import { initiatePaynowPayment, type PaynowMethod } from '@/lib/paynow'

const MERCHANT_EMAIL = process.env.PAYNOW_EMAIL ?? 'gustozw@gmail.com'

export async function POST(req: Request) {
  try {
    const session = await requireAuth().catch(() => null)

    const { orderId, method, phone, guestToken } = await req.json() as {
      orderId: string
      method: PaynowMethod
      phone?: string
      guestToken?: string
    }

    if (!orderId || !method) return error('orderId and method are required')

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    })

    if (!order) return error('Order not found', 404)

    // Auth: session user must own the order, or guestToken must match
    if (session) {
      if (order.userId !== session.id) return error('Order not found', 404)
    } else if (guestToken) {
      if (order.guestToken !== guestToken) return error('Order not found', 404)
    } else {
      return unauthorized()
    }

    if (order.status === 'paid') return error('Order is already paid')
    if (order.status === 'failed') return error('Order failed — please start a new order')

    const isMobile = ['ecocash', 'onemoney', 'innbucks', 'omari'].includes(method)
    if (isMobile && !phone) return error('Phone number is required for mobile payments')

    const description = order.items.map(i => i.name).join(', ')
    const buyerEmail = order.guestEmail ?? session?.email ?? MERCHANT_EMAIL

    const result = await initiatePaynowPayment({
      orderNumber: order.orderNumber,
      email: buyerEmail,
      description,
      amount: order.total,
      method,
      phone,
    })

    await prisma.order.update({
      where: { id: orderId },
      data: { paymentRef: result.pollUrl, paymentMethod: method },
    })

    return ok(result)
  } catch (e: any) {
    return serverError(e)
  }
}
