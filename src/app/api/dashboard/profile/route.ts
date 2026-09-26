import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { ok, error, unauthorized, serverError } from '@/lib/api'

const PROFILE_SELECT = {
  phone: true, firstName: true, lastName: true, name: true,
  email: true, homeTown: true, isWhatsApp: true, smsOptOutAt: true,
} as const

// Phone is the login identity, so it isn't editable here — see /api/dashboard/phone (SMS code).
const profileSchema = z.object({
  firstName:  z.string().trim().min(1, 'First name is required').max(50),
  lastName:   z.string().trim().max(50),
  email:      z.string().trim().toLowerCase().email('Enter a valid email').max(200).or(z.literal('')),
  homeTown:   z.string().trim().max(100),
  isWhatsApp: z.boolean(),
  smsPromos:  z.boolean().optional(), // false = opted out of promotional SMS
})

// GET /api/dashboard/profile — the logged-in user's editable profile
export async function GET() {
  try {
    const session = await requireAuth().catch(() => null)
    if (!session) return unauthorized()
    const user = await prisma.user.findUnique({ where: { id: session.id }, select: PROFILE_SELECT })
    if (!user) return unauthorized()
    return ok(user)
  } catch (e) {
    return serverError(e)
  }
}

// PATCH /api/dashboard/profile — update name, email, home town, WhatsApp preference
export async function PATCH(req: Request) {
  try {
    const session = await requireAuth().catch(() => null)
    if (!session) return unauthorized()

    const parsed = profileSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return error(parsed.error.issues.map(i => i.message).join('; '))
    const { firstName, lastName, email, homeTown, isWhatsApp, smsPromos } = parsed.data
    const current = smsPromos === undefined ? null
      : await prisma.user.findUnique({ where: { id: session.id }, select: { smsOptOutAt: true } })

    const user = await prisma.user.update({
      where: { id: session.id },
      data: {
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim(),
        email: email || null,
        homeTown: homeTown || null,
        isWhatsApp,
        // Keep the original opt-out date when it's already off
        ...(current && { smsOptOutAt: smsPromos ? null : (current.smsOptOutAt ?? new Date()) }),
      },
      select: PROFILE_SELECT,
    })
    return ok(user)
  } catch (e) {
    return serverError(e)
  }
}
