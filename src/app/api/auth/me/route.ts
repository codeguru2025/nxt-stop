import { getSession, requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ok, error, unauthorized, serverError } from '@/lib/api'
import { z } from 'zod'
import { getReferralPercent, DEFAULT_REFERRAL_PERCENT } from '@/lib/referralRate'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return unauthorized()

    const [user, referralPercent, eventParticipations] = await Promise.all([prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        homeTown: true,
        isWhatsApp: true,
        phone: true,
        role: true,
        email: true,
        capabilities: true,
        referralCode: true,
        points: true,
        totalEarned: true,
        avatar: true,
        createdAt: true,
        mustResetPassword: true,
        isPlatformOwner: true,
        _count: {
          select: {
            tickets: true,
            referralsMade: true,
            redemptions: true,
          },
        },
      },
    }),
    getReferralPercent().catch(() => DEFAULT_REFERRAL_PERCENT),
    // Upcoming events they're on the line-up for — the dashboard offers a link per event.
    // Kept separate and non-fatal: every logged-in page calls this route, so a problem
    // here (e.g. the EventParticipant migration not applied yet) must not log people out.
    prisma.eventParticipant.findMany({
      where: {
        userId: session.id,
        event: { date: { gte: new Date(Date.now() - 86_400_000) }, status: { notIn: ['draft', 'cancelled'] } },
      },
      orderBy: { event: { date: 'asc' } },
      select: { role: true, event: { select: { name: true, slug: true, date: true } } },
    }).catch((err) => {
      console.error('[auth/me] line-up lookup failed', err)
      return []
    })])

    if (!user) return unauthorized()
    return ok({ ...user, referralPercent, eventParticipations })
  } catch (e) {
    return serverError(e)
  }
}

// Minimal profile fields the user is allowed to self-edit — deliberately excludes
// role/capabilities/isPlatformOwner, which no route ever accepts from a request body.
const UpdateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  homeTown: z.string().trim().max(100).nullable().optional(),
  isWhatsApp: z.boolean().optional(),
  email: z.string().trim().toLowerCase().email().max(200).optional(),
})

export async function PATCH(req: Request) {
  try {
    const session = await requireAuth().catch(() => null)
    if (!session) return unauthorized()

    const body = await req.json().catch(() => ({}))
    const parsed = UpdateProfileSchema.safeParse(body)
    if (!parsed.success) {
      return error(parsed.error.issues.map((i) => i.message).join('; '))
    }

    const current = await prisma.user.findUnique({
      where: { id: session.id },
      select: { firstName: true, lastName: true },
    })
    if (!current) return unauthorized()

    const firstName = parsed.data.firstName ?? current.firstName ?? ''
    const lastName = parsed.data.lastName ?? current.lastName ?? ''

    const user = await prisma.user.update({
      where: { id: session.id },
      data: {
        ...parsed.data,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim() || undefined,
      },
      select: {
        id: true, name: true, firstName: true, lastName: true, homeTown: true,
        isWhatsApp: true, phone: true, email: true,
      },
    })

    return ok(user)
  } catch (e) {
    return serverError(e)
  }
}
