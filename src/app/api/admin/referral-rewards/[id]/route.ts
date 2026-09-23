import { prisma } from '@/lib/db'
import { requireCapability } from '@/lib/auth'
import { ok, error, forbidden, notFound, serverError } from '@/lib/api'
import { writeAuditLog } from '@/lib/auditLog'
import { holdForApproval } from '@/lib/approvals'
import { describeReferralPayout } from '@/lib/approvalDescribe'

// PATCH /api/admin/referral-rewards/[id] — mark a payout paid/cancelled
export async function PATCH(
  req: Request,
  ctx: RouteContext<'/api/admin/referral-rewards/[id]'>
) {
  try {
    const session = await requireCapability('referrals').catch(() => null)
    if (!session) return forbidden()
    const { id } = await ctx.params

    const body = await req.json().catch(() => ({}))
    const { status } = body
    if (!['paid', 'cancelled', 'pending'].includes(status)) return error('Invalid status')

    const existing = await prisma.referralReward.findUnique({ where: { id } })
    if (!existing) return notFound('Referral reward')

    const held = await holdForApproval(req, session, {
      action: 'referral-reward.update', capability: 'referrals', route: '/api/admin/referral-rewards/[id]', params: { id }, body,
      entityType: 'ReferralReward', entityId: id, describe: () => describeReferralPayout(id, body),
    })
    if (held) return held

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
