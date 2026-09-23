import { prisma } from '@/lib/db'
import { requireGateOrAdmin } from '@/lib/auth'
import { ok, error, unauthorized, serverError } from '@/lib/api'
import { acquireScanLock, checkScanLimit, releaseScanLock } from '@/lib/rateLimit'

// POST /api/scan/voucher — redeems a pre-event purchase (drink/liquor voucher, merch,
// table). Mirrors /api/scan's lock + atomic-update-as-guard pattern to avoid double-redeem
// races, but is fully separate from Ticket/ScanLog.
export async function POST(req: Request) {
  let scanLockKey: string | null = null
  try {
    const session = await requireGateOrAdmin().catch(() => null)
    if (!session) return unauthorized()

    const { limited } = await checkScanLimit(`user:${session.id}`)
    if (limited) return error('Rate limit exceeded — slow down', 429)

    const { qrCode: rawCode, eventId, deviceId } = await req.json()
    if (!rawCode) return error('QR code is required')

    const rawTrimmed = String(rawCode).trim()
    if (!rawTrimmed || rawTrimmed.length > 200) return error('Invalid code')

    const locked = await acquireScanLock(`voucher:${rawTrimmed}`)
    if (!locked) {
      return ok({ result: 'invalid', message: 'Scan already in progress — please try again' })
    }
    scanLockKey = `voucher:${rawTrimmed}`

    const voucherInclude = {
      product: { select: { name: true, category: true } },
      user: { select: { name: true, phone: true } },
    }

    // Try qrCode (UUID from the QR image) first, then the human-readable code for manual entry
    let voucher = await prisma.voucher.findUnique({ where: { qrCode: rawTrimmed.toLowerCase() }, include: voucherInclude })
    if (!voucher) {
      voucher = await prisma.voucher.findUnique({ where: { code: rawTrimmed.toUpperCase() }, include: voucherInclude }) ?? null
    }

    if (!voucher) {
      await logVoucherScan(null, eventId ?? null, session.id, 'invalid', deviceId)
      return ok({ result: 'invalid', message: 'Voucher not found' })
    }

    if (eventId && voucher.eventId && voucher.eventId !== eventId) {
      await logVoucherScan(voucher.id, voucher.eventId, session.id, 'invalid', deviceId)
      return ok({ result: 'invalid', message: 'Voucher is for a different event' })
    }

    if (voucher.status !== 'unredeemed') {
      await logVoucherScan(voucher.id, voucher.eventId, session.id, 'already_used', deviceId)
      return ok({
        result: 'already_used',
        message: voucher.status === 'redeemed' ? 'Voucher has already been redeemed' : 'Voucher was cancelled',
        redeemedAt: voucher.redeemedAt,
        voucher: { code: voucher.code, product: voucher.product.name, holder: voucher.user.name },
      })
    }

    // Atomic: only mark redeemed if still unredeemed — guards against a race between scanners
    const redeemedAt = new Date()
    const { count } = await prisma.voucher.updateMany({
      where: { id: voucher.id, status: 'unredeemed' },
      data: { status: 'redeemed', redeemedAt, redeemedById: session.id },
    })

    if (count === 0) {
      await logVoucherScan(voucher.id, voucher.eventId, session.id, 'already_used', deviceId)
      return ok({
        result: 'already_used',
        message: 'Voucher has already been redeemed',
        voucher: { code: voucher.code, product: voucher.product.name, holder: voucher.user.name },
      })
    }

    await logVoucherScan(voucher.id, voucher.eventId, session.id, 'valid', deviceId)

    return ok({
      result: 'valid',
      message: 'Redeemed',
      voucher: { code: voucher.code, product: voucher.product.name, holder: voucher.user.name },
    })
  } catch (e) {
    return serverError(e)
  } finally {
    if (scanLockKey) void releaseScanLock(scanLockKey)
  }
}

async function logVoucherScan(
  voucherId: string | null,
  eventId: string | null,
  scannedBy: string,
  result: string,
  deviceId?: string
) {
  if (!voucherId) return
  try {
    await prisma.voucherScanLog.create({
      data: { voucherId, eventId, scannedBy, result, deviceId },
    })
  } catch {
    // Non-critical
  }
}
