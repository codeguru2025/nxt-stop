import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { ok, error, unauthorized, serverError } from '@/lib/api'
import { checkAuthLimit } from '@/lib/rateLimit'
import { writeAuditLog } from '@/lib/auditLog'
import { redeemCode } from '@/lib/smsCodes'
import { startSession } from '@/lib/session'

// POST /api/dashboard/phone/verify — { code }
// Second step: the code sent to the new number moves the account (and its login) there.
export async function POST(req: Request) {
  try {
    const session = await requireAuth().catch(() => null)
    if (!session) return unauthorized()
    const { limited, retryAfter } = await checkAuthLimit(`phone-change:${session.id}`)
    if (limited) return error(`Too many attempts. Try again in ${retryAfter}s`, 429)

    const body = await req.json().catch(() => ({}))
    const code = String(body?.code ?? '')
    if (!/^\d{6}$/.test(code.trim())) return error('Enter the 6-digit code from the SMS')

    const used = await redeemCode('phone-change', { userId: session.id }, code)
    if (!used) return error('That code is wrong or has expired', 401)

    const taken = await prisma.user.findFirst({ where: { phone: used.phone, id: { not: session.id } }, select: { id: true } })
    if (taken) return error('That number already has an NXT STOP account')

    const before = await prisma.user.findUnique({ where: { id: session.id }, select: { phone: true } })
    const user = await prisma.user.update({ where: { id: session.id }, data: { phone: used.phone } })
    await startSession(user) // the session carries the phone number

    writeAuditLog({
      actorId: user.id, actorRole: user.role, req,
      action: 'account.phone-changed', entityType: 'User', entityId: user.id,
      before: { phone: before?.phone ?? null }, after: { phone: user.phone },
    })
    return ok({ phone: user.phone, message: 'Phone number updated — use it to sign in from now on' })
  } catch (e) {
    return serverError(e)
  }
}
