import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { ok, error, unauthorized, serverError } from '@/lib/api'
import { initiatePaynowPayment, type PaynowMethod } from '@/lib/paynow'

// POST /api/paynow/initiate
// Body: { orderId, method, phone? }
export async function POST(req: Request) {
  try {
    const session = await requireAuth().catch(() => null)
    if (!session) return unauthorized()

    const { orderId, method, phone } = await req.json() as {
      orderId: string
      method: PaynowMethod
      phone?: string
    }

    if (!orderId || !method) return error('orderId and method are required')

    const order = await prisma.order.findUnique({
      where: { id: orderId, userId: session.id },
      include: { items: true },
    })

    if (!order) return error('Order not found', 404)
    if (order.status === 'paid') return error('Order is already paid')
    if (order.status === 'failed') return error('Order failed — please start a new order')

    const isMobile = ['ecocash', 'onemoney', 'innbucks', 'omari'].includes(method)
    if (isMobile && !phone) return error('Phone number is required for mobile payments')

    const description = order.items.map(i => i.name).join(', ')

    const result = await initiatePaynowPayment({
      orderNumber: order.orderNumber,
      email: session.email,
      description,
      amount: order.total,
      method,
      phone,
    })

    // Persist the pollUrl so webhook + server-side poll can use it
    await prisma.order.update({
      where: { id: orderId },
      data: { paymentRef: result.pollUrl, paymentMethod: method },
    })

    return ok(result)
  } catch (e: any) {
    return serverError(e)
  }
}
