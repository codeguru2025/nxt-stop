import { prisma } from '@/lib/db'
import { requireCapability } from '@/lib/auth'
import { ok, error, forbidden, notFound, serverError } from '@/lib/api'
import { writeAuditLog } from '@/lib/auditLog'

// POST /api/admin/teams/[id]/members — add an existing user to a team by phone number
export async function POST(
  req: Request,
  ctx: RouteContext<'/api/admin/teams/[id]/members'>
) {
  try {
    const session = await requireCapability('teams').catch(() => null)
    if (!session) return forbidden()
    const { id: teamId } = await ctx.params

    const team = await prisma.team.findUnique({ where: { id: teamId } })
    if (!team) return notFound('Team')

    const { phone } = await req.json().catch(() => ({}))
    if (!phone || typeof phone !== 'string') return error('Phone number is required')

    const user = await prisma.user.findUnique({ where: { phone: phone.trim() } })
    if (!user) return error('No user found with that phone number', 404)

    const existing = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: user.id } },
    })
    if (existing) return error('This user is already on the team')

    const member = await prisma.teamMember.create({
      data: { teamId, userId: user.id },
      include: { user: { select: { name: true, phone: true } } },
    })

    writeAuditLog({
      actorId: session.id, actorRole: session.role,
      action: 'team.member.add', entityType: 'Team', entityId: teamId,
      after: { userId: user.id, name: user.name }, req,
    })

    return ok(member, 201)
  } catch (e) {
    return serverError(e)
  }
}

// DELETE /api/admin/teams/[id]/members?userId=xxx
export async function DELETE(
  req: Request,
  ctx: RouteContext<'/api/admin/teams/[id]/members'>
) {
  try {
    const session = await requireCapability('teams').catch(() => null)
    if (!session) return forbidden()
    const { id: teamId } = await ctx.params

    const userId = new URL(req.url).searchParams.get('userId')
    if (!userId) return error('userId is required')

    const existing = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    })
    if (!existing) return notFound('Team member')

    await prisma.teamMember.delete({ where: { teamId_userId: { teamId, userId } } })

    writeAuditLog({
      actorId: session.id, actorRole: session.role,
      action: 'team.member.remove', entityType: 'Team', entityId: teamId,
      before: { userId }, req,
    })

    return ok({ message: 'Member removed' })
  } catch (e) {
    return serverError(e)
  }
}
