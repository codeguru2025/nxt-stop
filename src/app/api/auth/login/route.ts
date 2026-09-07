import { prisma } from '@/lib/db'
import { signToken } from '@/lib/auth'
import { ok, error, serverError } from '@/lib/api'
import { checkAuthLimit } from '@/lib/rateLimit'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'

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

    const user = await prisma.user.findUnique({ where: { phone: phone.trim() } })
    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH)
    if (!user || !valid) return error('Invalid credentials', 401)

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

    return ok({
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        referralCode: user.referralCode,
        points: user.points,
      },
    })
  } catch (e) {
    return serverError(e)
  }
}
