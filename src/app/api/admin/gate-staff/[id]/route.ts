import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, error, forbidden, serverError } from '@/lib/api'

// DELETE /api/admin/gate-staff/[id] — revoke gate staff access
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()

    const { id } = await params

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } })
    if (!user) return error('User not found', 404)
    if (user.role !== 'gate_staff') return error('User is not gate staff', 400)

    await prisma.user.delete({ where: { id } })

    return ok({ message: 'Gate staff account removed' })
  } catch (e) {
    return serverError(e)
  }
}
