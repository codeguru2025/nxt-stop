import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { ok, unauthorized, serverError } from '@/lib/api'
import { generateQRDataURL } from '@/lib/qr'

export async function GET(req: Request) {
  try {
    const session = await requireAuth().catch(() => null)
    const { searchParams } = new URL(req.url)
    const guestToken = searchParams.get('guestToken')

    let userId: string | null = null

    if (session) {
      userId = session.id
    } else if (guestToken) {
      const order = await prisma.order.findUnique({ where: { guestToken } })
      if (order) userId = order.userId
    }

    if (!userId) return unauthorized()

    const tickets = await prisma.ticket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        event: {
          select: {
            id: true, name: true, slug: true, date: true, endDate: true,
            venue: true, address: true, posterImage: true, lat: true, lng: true,
          },
        },
        ticketType: { select: { name: true, color: true, price: true } },
        order: { select: { total: true, subtotal: true, recipientName: true } },
      },
    })

    const ticketsWithQR = await Promise.all(
      tickets.map(async t => ({
        ...t,
        qrDataUrl: await generateQRDataURL(t.qrCode),
      }))
    )

    return ok(ticketsWithQR)
  } catch (e) {
    return serverError(e)
  }
}
