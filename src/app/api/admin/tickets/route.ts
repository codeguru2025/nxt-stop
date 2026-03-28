import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, forbidden, serverError } from '@/lib/api'
import { generateQRDataURL } from '@/lib/qr'

// GET /api/admin/tickets?search=&eventId=&status=&page=
export async function GET(req: Request) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') ?? ''
    const eventId = searchParams.get('eventId') ?? ''
    const status = searchParams.get('status') ?? ''
    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = 50

    const where: any = {}
    if (eventId) where.eventId = eventId
    if (status) where.status = status
    if (search) {
      where.OR = [
        { ticketNumber: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { order: { recipientName: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          event: { select: { name: true, date: true, venue: true } },
          ticketType: { select: { name: true, color: true, price: true } },
          user: { select: { name: true, email: true } },
          order: { select: { orderNumber: true, paymentMethod: true, total: true, status: true, recipientName: true, guestName: true } },
        },
      }),
      prisma.ticket.count({ where }),
    ])

    return ok({ tickets, total, page, pages: Math.ceil(total / limit) })
  } catch (e) {
    return serverError(e)
  }
}
