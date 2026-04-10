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

    const { qrCode: rawCode, eventId, deviceId } = await req.json()
    if (!rawCode) return error('QR code is required')

    // Trim whitespace (barcode scanners often append \n or trailing spaces)
    // Normalise to uppercase so ticket numbers typed in lowercase still match
    const qrCode = String(rawCode).trim().toUpperCase()
    if (!qrCode || qrCode.length > 200) return error('Invalid QR code')

    // Distributed lock: prevent double-scan race across multiple gate instances.
    // Lock on the input value — good enough for camera scans (UUID).
    // Manual entry by ticket number uses a different key than the UUID, but the
    // atomic updateMany below is the real guard in that case.
    const locked = await acquireScanLock(qrCode)
    if (!locked) {
      return ok({ result: 'invalid', message: 'Scan already in progress — please try again' })
    }

    const ticketInclude = {
      event: { select: { id: true, name: true, date: true, venue: true, posterImage: true } },
      ticketType: { select: { name: true, color: true, price: true } },
      user: { select: { name: true, email: true } },
      order: { select: { recipientName: true, guestName: true } },
    }

    // UUIDs are stored lowercase; normalise back for qrCode lookup only
    const qrCodeLower = qrCode.toLowerCase()

    // Try qrCode first (UUID from QR image), then fall back to ticket number for manual entry
    let ticket = await prisma.ticket.findUnique({ where: { qrCode: qrCodeLower }, include: ticketInclude })
    if (!ticket) {
      // ticketNumber is stored uppercase (NXT-...) — already uppercased above
      ticket = await prisma.ticket.findUnique({ where: { ticketNumber: qrCode }, include: ticketInclude }) ?? null
    }

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
      const usedHolder = (ticket.order as any)?.recipientName || (ticket.order as any)?.guestName || ticket.user?.name || 'Unknown'
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

    if (ticket.status === 'physical') {
      await logScan(ticket.id, ticket.eventId, session.id, 'invalid', deviceId)
      const payload = { result: 'invalid', message: 'Ticket not activated — not yet sold. Activate it at the sales desk.' }
      emitScanEvent(ticket.eventId, payload)
      return ok(payload)
    }

    if (ticket.status !== 'valid') {
      await logScan(ticket.id, ticket.eventId, session.id, 'invalid', deviceId)
      const statusMessages: Record<string, string> = {
        cancelled: 'This ticket has been cancelled',
        refunded:  'This ticket has been refunded',
      }
      const payload = { result: 'invalid', message: statusMessages[ticket.status] ?? `Ticket cannot be used (status: ${ticket.status})` }
      emitScanEvent(ticket.eventId, payload)
      return ok(payload)
    }

    // Atomic: only mark used if status is still 'valid' — guards against race between two scanners
    const usedAt = new Date()
    const { count } = await prisma.ticket.updateMany({
      where: { id: ticket.id, status: 'valid' },
      data: { status: 'used', usedAt },
    })

    if (count === 0) {
      // Another scanner beat us to this ticket — re-fetch the actual usedAt
      // so we show the correct time rather than this scanner's local clock.
      const fresh = await prisma.ticket.findUnique({ where: { id: ticket.id }, select: { usedAt: true } })
      await logScan(ticket.id, ticket.eventId, session.id, 'already_used', deviceId)
      const holderName = (ticket.order as any)?.recipientName || (ticket.order as any)?.guestName || ticket.user?.name || 'Unknown'
      const payload = {
        result: 'already_used',
        message: 'Ticket has already been used',
        usedAt: fresh?.usedAt ?? usedAt,
        ticket: {
          number: ticket.ticketNumber,
          holder: holderName,
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

    await logScan(ticket.id, ticket.eventId, session.id, 'valid', deviceId)

    const holderName = (ticket.order as any)?.recipientName || (ticket.order as any)?.guestName || ticket.user?.name || 'Unknown'
    const payload = {
      result: 'valid',
      message: 'Entry granted',
      ticket: {
        number: ticket.ticketNumber,
        holder: holderName,
        email: ticket.user?.email,
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
