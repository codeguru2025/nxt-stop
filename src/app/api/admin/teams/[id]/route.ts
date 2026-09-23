import { prisma } from '@/lib/db'
import { requireCapability } from '@/lib/auth'
import { ok, error, forbidden, notFound, serverError } from '@/lib/api'
import { writeAuditLog } from '@/lib/auditLog'

// PATCH /api/admin/teams/[id] — rename a team
export async function PATCH(
  req: Request,
  ctx: RouteContext<'/api/admin/teams/[id]'>
) {
  try {
    const session = await requireCapability('teams').catch(() => null)
    if (!session) return forbidden()
    const { id } = await ctx.params

    const { name } = await req.json().catch(() => ({}))
    if (!name || typeof name !== 'string' || !name.trim()) return error('Team name is required')

    const existing = await prisma.team.findUnique({ where: { id } })
    if (!existing) return notFound('Team')

    const team = await prisma.team.update({ where: { id }, data: { name: name.trim() } })

    writeAuditLog({
      actorId: session.id, actorRole: session.role,
      action: 'team.update', entityType: 'Team', entityId: id,
      before: { name: existing.name }, after: { name: team.name }, req,
    })

    return ok(team)
  } catch (e) {
    return serverError(e)
  }
}

// DELETE /api/admin/teams/[id]
export async function DELETE(
  req: Request,
  ctx: RouteContext<'/api/admin/teams/[id]'>
) {
  try {
    const session = await requireCapability('teams').catch(() => null)
    if (!session) return forbidden()
    const { id } = await ctx.params

    const existing = await prisma.team.findUnique({ where: { id } })
    if (!existing) return notFound('Team')

    await prisma.team.delete({ where: { id } })

    writeAuditLog({
      actorId: session.id, actorRole: session.role,
      action: 'team.delete', entityType: 'Team', entityId: id,
      before: { name: existing.name }, req,
    })

    return ok({ message: 'Team deleted' })
  } catch (e) {
    return serverError(e)
  }
}
