import { prisma } from '@/lib/db'
import { signToken } from '@/lib/auth'
import { ok, error, serverError } from '@/lib/api'
import { checkAuthLimit } from '@/lib/rateLimit'
import { writeAuditLog } from '@/lib/auditLog'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { normalizeWhatsAppPhone } from '@/lib/phone'

// Bcrypt hash of a random, unused string — compared against when no user is found so
// login always takes the same time whether or not the phone number is registered.
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8zM/rP03tG3z3v/AQZ1c1M99gJcuVe'

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    const { limited, retryAfter } = await checkAuthLimit(ip)
    if (limited) return error(`Too many attempts. Try again in ${retryAfter}s`, 429)

    const { phone, password } = await req.json()
    if (!phone || !password) return error('Phone number and password required')

    // Accounts created at checkout/sales desk store phones normalized (+263...), but people
    // type 0771...; older accounts may be stored as typed. Match either form.
    const typed = String(phone).trim()
    const normalized = normalizeWhatsAppPhone(typed)
    const user = await prisma.user.findFirst({
      where: { phone: { in: normalized && normalized !== typed ? [typed, normalized] : [typed] } },
    })
    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH)
    if (!user || !valid) {
      writeAuditLog({ action: 'auth.login.failure', entityType: 'User', entityId: user?.id ?? null, req })
      return error('Invalid credentials', 401)
    }

    // First successful login on a system-issued one-time password — record it so we
    // know the OTP has been consumed. mustResetPassword itself is only ever cleared
    // by POST /api/auth/set-password, which is the actual single-use enforcement.
    if (user.mustResetPassword && !user.oneTimePasswordUsedAt) {
      await prisma.user.update({ where: { id: user.id }, data: { oneTimePasswordUsedAt: new Date() } })
    }

    const token = await signToken({
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      referralCode: user.referralCode,
    })

    const cookieStore = await cookies()
    cookieStore.set('nxt-session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    writeAuditLog({ actorId: user.id, actorRole: user.role, action: 'auth.login.success', entityType: 'User', entityId: user.id, req })

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
