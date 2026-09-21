import { prisma } from '@/lib/db'
import { requireCapability } from '@/lib/auth'
import { forbidden, notFound, serverError } from '@/lib/api'
import { createTicketAttachmentPng } from '@/lib/ticketAttachment'

// GET /api/admin/tickets/[id]/download — the same PNG image sent over WhatsApp/email,
// so an admin can hand a ticket to someone whose automatic delivery failed.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireCapability('tickets').catch(() => null)
    if (!session) return forbidden()
    const { id } = await ctx.params

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        event: { select: { name: true, venue: true, address: true, date: true, endDate: true } },
        ticketType: { select: { name: true, color: true, price: true } },
        user: { select: { name: true } },
        order: { select: { recipientName: true, guestName: true, whatsappName: true } },
      },
    })
    if (!ticket) return notFound('Ticket')

    const holderName =
      ticket.order?.recipientName || ticket.order?.guestName || ticket.order?.whatsappName || ticket.user.name

    const png = await createTicketAttachmentPng({
      ticketNumber: ticket.ticketNumber,
      status: ticket.status,
      eventName: ticket.event.name,
      eventVenue: ticket.event.venue,
      eventAddress: ticket.event.address,
      eventDate: ticket.event.date,
      eventEndDate: ticket.event.endDate,
      ticketTypeName: ticket.ticketType.name,
      ticketTypeColor: ticket.ticketType.color,
      ticketPrice: Number(ticket.ticketType.price),
      holderName,
      qrCode: ticket.qrCode,
    })

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
