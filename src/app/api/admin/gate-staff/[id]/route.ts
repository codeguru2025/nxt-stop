import { prisma } from '@/lib/db'
import { requireCapability } from '@/lib/auth'
import { ok, error, forbidden, serverError } from '@/lib/api'
import bcrypt from 'bcryptjs'
import { holdForApproval } from '@/lib/approvals'
import { describeGateStaffPassword, describeGateStaffRemove } from '@/lib/approvalDescribe'

// PATCH /api/admin/gate-staff/[id] — reset gate staff password
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireCapability('gate_staff').catch(() => null)
    if (!session) return forbidden()

    const { id } = await params
    const body = await req.json()
    const { password } = body

    if (!password || password.length < 8) return error('Password must be at least 8 characters')

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } })
    if (!user) return error('User not found', 404)
    if (user.role !== 'gate_staff') return error('User is not gate staff', 400)

    const held = await holdForApproval(req, session, {
      action: 'gate-staff.password', capability: 'gate_staff', route: '/api/admin/gate-staff/[id]', params: { id }, body,
      entityType: 'User', entityId: id, describe: () => describeGateStaffPassword(id),
    })
    if (held) return held

    const passwordHash = await bcrypt.hash(password, 10)
    await prisma.user.update({ where: { id }, data: { passwordHash } })

    return ok({ message: 'Password updated' })
  } catch (e) {
    return serverError(e)
  }
}

// DELETE /api/admin/gate-staff/[id] — revoke gate staff access
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireCapability('gate_staff').catch(() => null)
    if (!session) return forbidden()

    const { id } = await params

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } })
    if (!user) return error('User not found', 404)
    if (user.role !== 'gate_staff') return error('User is not gate staff', 400)

    const held = await holdForApproval(req, session, {
      action: 'gate-staff.remove', capability: 'gate_staff', route: '/api/admin/gate-staff/[id]', params: { id },
      entityType: 'User', entityId: id, describe: () => describeGateStaffRemove(id),
    })
    if (held) return held

    await prisma.user.delete({ where: { id } })

    return ok({ message: 'Gate staff account removed' })
  } catch (e) {
    return serverError(e)
  }
}
