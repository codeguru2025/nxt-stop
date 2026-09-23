import { prisma } from '@/lib/db'
import { requireCapability } from '@/lib/auth'
import { ok, error, forbidden, serverError } from '@/lib/api'
import bcrypt from 'bcryptjs'
import { holdForApproval } from '@/lib/approvals'
import { describePasswordReset } from '@/lib/approvalDescribe'

// PATCH /api/admin/password-resets/[id]
// Body: { password?: string, action: 'approve' | 'reject' }
// approve  → hashes password, updates user.passwordHash, marks request processed
// reject   → marks request rejected (no password change)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireCapability('password_resets').catch(() => null)
    if (!session) return forbidden()

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const action = body?.action === 'reject' ? 'reject' : 'approve'

    const request = await prisma.passwordResetRequest.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true },
    })
    if (!request) return error('Request not found', 404)
    if (request.status !== 'pending') return error('Request already processed', 409)

    if (action === 'reject') {
      await prisma.passwordResetRequest.update({
        where: { id },
        data: { status: 'rejected', processedAt: new Date(), processedBy: session.id },
      })
      return ok({ message: 'Request rejected' })
    }

    const password = String(body?.password ?? '')
    if (password.length < 8) return error('Password must be at least 8 characters')
    if (password.length > 200) return error('Password too long')

    const held = await holdForApproval(req, session, {
      action: 'password-reset.approve', capability: 'password_resets', route: '/api/admin/password-resets/[id]', params: { id }, body,
      entityType: 'PasswordResetRequest', entityId: id, describe: () => describePasswordReset(id),
    })
    if (held) return held

    const passwordHash = await bcrypt.hash(password, 10)

    await prisma.$transaction([
      prisma.user.update({ where: { id: request.userId }, data: { passwordHash } }),
      prisma.passwordResetRequest.update({
        where: { id },
        data: { status: 'processed', processedAt: new Date(), processedBy: session.id },
      }),
    ])

    return ok({ message: 'Password reset' })
  } catch (e) {
    return serverError(e)
  }
}
