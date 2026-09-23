import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, forbidden, serverError } from '@/lib/api'
import { expireStaleRequests } from '@/lib/approvals'

// GET /api/admin/approvals — requests waiting for approval plus recent history.
// Every admin sees the list; whether they may decide a request is returned per row
// (the decision route re-checks it).
export async function GET() {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()
    await expireStaleRequests()

    const me = await prisma.user.findUnique({ where: { id: session.id }, select: { capabilities: true, isPlatformOwner: true } })
    const canDecide = (capability: string | null, requestedById: string) =>
      requestedById !== session.id && (!!me?.isPlatformOwner || !capability || !!me?.capabilities.includes(capability))

    const select = {
      id: true, action: true, capability: true, title: true, changes: true, status: true,
      reviewNote: true, failureReason: true, createdAt: true, reviewedAt: true, expiresAt: true, requestedById: true,
      requestedBy: { select: { name: true } },
      reviewedBy: { select: { name: true } },
    } as const

    const [pending, recent] = await Promise.all([
      prisma.changeRequest.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' }, select }),
      prisma.changeRequest.findMany({ where: { status: { not: 'pending' } }, orderBy: { createdAt: 'desc' }, take: 50, select }),
    ])

    const shape = (r: (typeof pending)[number]) => ({
      ...r,
      mine: r.requestedById === session.id,
      canDecide: r.status === 'pending' && canDecide(r.capability, r.requestedById),
    })

    return ok({
      pending: pending.map(shape),
      recent: recent.map(shape),
      waitingOnMe: pending.filter(r => canDecide(r.capability, r.requestedById)).length,
    })
  } catch (e) {
    return serverError(e)
  }
}
