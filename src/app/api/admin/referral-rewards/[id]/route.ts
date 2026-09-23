import { prisma } from '@/lib/db'
import { requireCapability } from '@/lib/auth'
import { ok, error, forbidden, notFound, serverError } from '@/lib/api'
import { writeAuditLog } from '@/lib/auditLog'

// PATCH /api/admin/referral-rewards/[id] — mark a payout paid/cancelled
export async function PATCH(
  req: Request,
  ctx: RouteContext<'/api/admin/referral-rewards/[id]'>
) {
  try {
    const session = await requireCapability('referrals').catch(() => null)
    if (!session) return forbidden()
    const { id } = await ctx.params

    const { status } = await req.json().catch(() => ({}))
    if (!['paid', 'cancelled', 'pending'].includes(status)) return error('Invalid status')

    const existing = await prisma.referralReward.findUnique({ where: { id } })
    if (!existing) return notFound('Referral reward')

    const updated = await prisma.referralReward.update({
      where: { id },
      data: { status, paidAt: status === 'paid' ? new Date() : null },
    })

    writeAuditLog({
      actorId: session.id,
      actorRole: session.role,
      action: 'referral-reward.update',
      entityType: 'ReferralReward',
      entityId: id,
      before: { status: existing.status },
      after: { status: updated.status },
      req,
    })

    return ok(updated)
  } catch (e) {
    return serverError(e)
  }
}
