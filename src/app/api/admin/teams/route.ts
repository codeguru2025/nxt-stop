import { prisma } from '@/lib/db'
import { requireCapability } from '@/lib/auth'
import { ok, error, forbidden, serverError } from '@/lib/api'
import { writeAuditLog } from '@/lib/auditLog'

// GET /api/admin/teams — list teams with member roll-ups (referral cash + partner commissions)
export async function GET() {
  try {
    const session = await requireCapability('teams').catch(() => null)
    if (!session) return forbidden()

    const teams = await prisma.team.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true, name: true, phone: true,
                referralRewards: { select: { amount: true, status: true } },
                partnerProfile: { select: { totalEarned: true } },
              },
            },
          },
        },
      },
    })

    const shaped = teams.map((t) => ({
      id: t.id,
      name: t.name,
      createdAt: t.createdAt,
      members: t.members.map((m) => {
        const referralTotal = m.user.referralRewards.reduce((s, r) => s + Number(r.amount), 0)
        const partnerTotal = m.user.partnerProfile ? Number(m.user.partnerProfile.totalEarned) : 0
        return {
          userId: m.user.id,
          name: m.user.name,
          phone: m.user.phone,
          referralTotal,
          partnerTotal,
          total: referralTotal + partnerTotal,
          joinedAt: m.joinedAt,
        }
      }),
    }))

    return ok(shaped)
  } catch (e) {
    return serverError(e)
  }
}

// POST /api/admin/teams — create a team
export async function POST(req: Request) {
  try {
    const session = await requireCapability('teams').catch(() => null)
    if (!session) return forbidden()

    const { name } = await req.json().catch(() => ({}))
    if (!name || typeof name !== 'string' || !name.trim()) return error('Team name is required')

    const team = await prisma.team.create({ data: { name: name.trim() } })

    writeAuditLog({
      actorId: session.id, actorRole: session.role,
      action: 'team.create', entityType: 'Team', entityId: team.id,
      after: { name: team.name }, req,
    })

    return ok(team, 201)
  } catch (e) {
    return serverError(e)
  }
}
