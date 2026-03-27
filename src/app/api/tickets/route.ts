import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { ok, unauthorized, serverError } from '@/lib/api'
import { generateQRDataURL } from '@/lib/qr'

export async function GET() {
  try {
    const session = await requireAuth().catch(() => null)
    if (!session) return unauthorized()

    const tickets = await prisma.ticket.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: 'desc' },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            slug: true,
            date: true,
            venue: true,
            address: true,
            posterImage: true,
          },
        },
        ticketType: { select: { name: true, color: true } },
      },
    })

    // Attach QR data URLs
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
