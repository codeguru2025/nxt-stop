import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, forbidden, serverError } from '@/lib/api'

// GET /api/admin/ecocash-sms?status=unmatched — recent inbound EcoCash SMS log,
// for diagnosing payments the auto-matcher couldn't confidently link to an order.
// Cross-reference parsedAmount/parsedPayer/parsedTxRef against /api/admin/orders,
// then use the existing POST /api/admin/orders { action: 'fulfill' } to complete it.
export async function GET(req: Request) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') ?? ''

    const logs = await prisma.ecocashSmsLog.findMany({
      where: status ? { matchStatus: status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return ok({ logs })
  } catch (e) {
    return serverError(e)
  }
}
