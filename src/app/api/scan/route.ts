import { prisma } from '@/lib/db'
import { requireGateOrAdmin } from '@/lib/auth'
import { ok, error, unauthorized, serverError } from '@/lib/api'
import { acquireScanLock, checkScanLimit } from '@/lib/rateLimit'

function getIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
}

function emitScanEvent(eventId: string, payload: object) {
  try {
    const io = (global as any).__io
    if (!io) return
    io.to(`gate:${eventId}`).emit('scan:result', payload)
    io.to('admin:scans').emit('scan:result', { eventId, ...payload })
  } catch {
    // Non-critical — gate still works without socket
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireGateOrAdmin().catch(() => null)
    if (!session) return unauthorized()

    const ip = getIp(req)
    const { limited } = await checkScanLimit(ip)
    if (limited) return error('Rate limit exceeded — slow down', 429)

    const { qrCode, eventId, deviceId } = await req.json()
    if (!qrCode) return error('QR code is required')

    // Distributed lock: prevent double-scan race across multiple gate instances
    const locked = await acquireScanLock(qrCode)
    if (!locked) {
      return ok({ result: 'invalid', message: 'Scan already in progress — please try again' })
    }

    const ticket = await prisma.ticket.findUnique({
      where: { qrCode },
      include: {
        event: { select: { id: true, name: true, date: true, venue: true, posterImage: true } },
        ticketType: { select: { name: true, color: true, price: true } },
        user: { select: { name: true, email: true } },
        order: { select: { recipientName: true, guestName: true } },
      },
    })

    if (!ticket) {
      await logScan(null, eventId ?? '', session.id, 'invalid', deviceId)
      const payload = { result: 'invalid', message: 'Ticket not found' }
      if (eventId) emitScanEvent(eventId, payload)
      return ok(payload)
    }

    if (eventId && ticket.eventId !== eventId) {
      await logScan(ticket.id, ticket.eventId, session.id, 'invalid', deviceId)
      const payload = { result: 'invalid', message: 'Ticket is for a different event' }
      emitScanEvent(ticket.eventId, payload)
      return ok(payload)
    }

    if (ticket.status === 'used') {
      await logScan(ticket.id, ticket.eventId, session.id, 'already_used', deviceId)
      const usedHolder = (ticket.order as any)?.recipientName || (ticket.order as any)?.guestName || ticket.user.name
      const payload = {
        result: 'already_used',
        message: 'Ticket has already been used',
        usedAt: ticket.usedAt,
        ticket: {
          number: ticket.ticketNumber,
          holder: usedHolder,
          type: ticket.ticketType.name,
          color: (ticket.ticketType as any).color,
          price: (ticket.ticketType as any).price,
          event: ticket.event.name,
          venue: (ticket.event as any).venue,
        },
      }
      emitScanEvent(ticket.eventId, payload)
      return ok(payload)
    }

    if (ticket.status !== 'valid') {
      await logScan(ticket.id, ticket.eventId, session.id, 'invalid', deviceId)
      const payload = { result: 'invalid', message: `Ticket status: ${ticket.status}` }
      emitScanEvent(ticket.eventId, payload)
      return ok(payload)
    }

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: 'used', usedAt: new Date() },
    })

    await logScan(ticket.id, ticket.eventId, session.id, 'valid', deviceId)

    const holderName = (ticket.order as any)?.recipientName || (ticket.order as any)?.guestName || ticket.user.name
    const payload = {
      result: 'valid',
      message: 'Entry granted',
      ticket: {
        number: ticket.ticketNumber,
        holder: holderName,
        email: ticket.user.email,
        type: ticket.ticketType.name,
        color: (ticket.ticketType as any).color,
        price: (ticket.ticketType as any).price,
        event: ticket.event.name,
        venue: (ticket.event as any).venue,
        date: (ticket.event as any).date,
        posterImage: (ticket.event as any).posterImage,
      },
    }
    emitScanEvent(ticket.eventId, payload)
    return ok(payload)
  } catch (e) {
    return serverError(e)
  }
}

async function logScan(
  ticketId: string | null,
  eventId: string,
  scannedBy: string,
  result: string,
  deviceId?: string
) {
  if (!ticketId || !eventId) return
  try {
    await prisma.scanLog.create({
      data: { ticketId, eventId, scannedBy, result, deviceId },
    })
  } catch {
    // Non-critical
  }
}
