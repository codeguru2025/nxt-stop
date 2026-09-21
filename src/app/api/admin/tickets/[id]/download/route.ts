import { prisma } from '@/lib/db'
import { requireCapability } from '@/lib/auth'
import { forbidden, notFound, serverError } from '@/lib/api'
import { createTicketAttachmentPng, createTicketAttachmentPdf } from '@/lib/ticketAttachment'

// GET /api/admin/tickets/[id]/download?format=png|pdf — the same image sent over
// WhatsApp/email, so an admin can hand a ticket to someone whose automatic
// delivery failed. Defaults to PNG; ?format=pdf returns a printable PDF instead.
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireCapability('tickets').catch(() => null)
    if (!session) return forbidden()
    const { id } = await ctx.params
    const format = new URL(req.url).searchParams.get('format') === 'pdf' ? 'pdf' : 'png'

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        event: { select: { name: true, venue: true, address: true, date: true, endDate: true, posterImage: true } },
        ticketType: { select: { name: true, color: true, price: true } },
        user: { select: { name: true } },
        order: { select: { recipientName: true, guestName: true, whatsappName: true } },
      },
    })
    if (!ticket) return notFound('Ticket')

    const holderName =
      ticket.order?.recipientName || ticket.order?.guestName || ticket.order?.whatsappName || ticket.user.name

    const attachmentInput = {
      ticketNumber: ticket.ticketNumber,
      status: ticket.status,
      eventName: ticket.event.name,
      eventVenue: ticket.event.venue,
      eventAddress: ticket.event.address,
      eventDate: ticket.event.date,
      eventEndDate: ticket.event.endDate,
      eventPosterImage: ticket.event.posterImage,
      ticketTypeName: ticket.ticketType.name,
      ticketTypeColor: ticket.ticketType.color,
      ticketPrice: Number(ticket.ticketType.price),
      holderName,
      qrCode: ticket.qrCode,
    }

    if (format === 'pdf') {
      const pdf = await createTicketAttachmentPdf(attachmentInput)
      return new Response(new Uint8Array(pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${ticket.ticketNumber}.pdf"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    const png = await createTicketAttachmentPng(attachmentInput)
    return new Response(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${ticket.ticketNumber}.png"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return serverError(e)
  }
}
