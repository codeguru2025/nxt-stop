import { prisma } from '@/lib/db'
import { requireGateOrAdmin } from '@/lib/auth'
import { ok, unauthorized, serverError } from '@/lib/api'

export async function GET() {
  try {
    const session = await requireGateOrAdmin().catch(() => null)
    if (!session) return unauthorized()

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const logs = await prisma.scanLog.findMany({
      where: { scannedBy: session.id, createdAt: { gte: todayStart } },
      select: { result: true },
    })

    const totals = { scanned: logs.length, valid: 0, invalid: 0, early: 0, used: 0 }
    for (const l of logs) {
      if (l.result === 'valid')       totals.valid++
      else if (l.result === 'invalid') totals.invalid++
      else if (l.result === 'early_scan') totals.early++
      else if (l.result === 'already_used') totals.used++
    }

    return ok(totals)
  } catch (e) {
    return serverError(e)
  }
}
