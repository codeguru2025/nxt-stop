import { prisma } from '@/lib/db'
import { ok, error, serverError } from '@/lib/api'
import { checkAuthLimit } from '@/lib/rateLimit'
import { normalizeWhatsAppPhone } from '@/lib/phone'
import { writeAuditLog } from '@/lib/auditLog'
import { redeemCode } from '@/lib/smsCodes'
import { startSession } from '@/lib/session'

// POST /api/auth/login-code/verify — { phone, code }
export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    const { limited, retryAfter } = await checkAuthLimit(ip)
    if (limited) return error(`Too many attempts. Try again in ${retryAfter}s`, 429)

    const body = await req.json().catch(() => ({}))
    const phone = normalizeWhatsAppPhone(String(body?.phone ?? ''))
    const code = String(body?.code ?? '')
    if (!phone || !/^\d{6}$/.test(code.trim())) return error('Enter the 6-digit code from the SMS')

    const used = await redeemCode('login', { phone }, code)
    const user = used ? await prisma.user.findUnique({ where: { id: used.userId } }) : null
    if (!user) {
      writeAuditLog({ action: 'auth.login-code.failure', entityType: 'User', entityId: used?.userId ?? null, req })
      return error('That code is wrong or has expired', 401)
    }

    await startSession(user)
    writeAuditLog({ actorId: user.id, actorRole: user.role, action: 'auth.login-code.success', entityType: 'User', entityId: user.id, req })

    return ok({
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        referralCode: user.referralCode,
        points: user.points,
        mustResetPassword: user.mustResetPassword,
      },
    })
  } catch (e) {
    return serverError(e)
  }
}
