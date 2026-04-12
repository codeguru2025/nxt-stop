import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, forbidden, notFound, serverError } from '@/lib/api'
import { generateQRDataURL } from '@/lib/qr'

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()
    const { id } = await ctx.params

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            slug: true,
            date: true,
            endDate: true,
            venue: true,
            address: true,
            posterImage: true,
            lat: true,
            lng: true,
          },
        },
        ticketType: { select: { name: true, color: true, price: true } },
        user: { select: { name: true, phone: true } },
        order: {
          select: {
            orderNumber: true,
            total: true,
            subtotal: true,
            status: true,
            recipientName: true,
            guestName: true,
          },
        },
      },
    })
    if (!ticket) return notFound('Ticket')

    const qrDataUrl = await generateQRDataURL(ticket.qrCode)
    return ok({ ...ticket, qrDataUrl })
  } catch (e) {
    return serverError(e)
  }
}
