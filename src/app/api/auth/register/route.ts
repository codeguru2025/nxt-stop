import { prisma } from '@/lib/db'
import { signToken } from '@/lib/auth'
import { ok, error, serverError } from '@/lib/api'
import { checkAuthLimit } from '@/lib/rateLimit'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    const { limited, retryAfter } = await checkAuthLimit(ip)
    if (limited) return error(`Too many attempts. Try again in ${retryAfter}s`, 429)

    const { name, email, phone, password, referralCode: referredBy } = await req.json()

    if (!name || !email || !password) {
      return error('Name, email, and password are required')
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return error('Email already registered')

    const passwordHash = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: { name, email, phone, passwordHash },
    })

    // Handle referral
    if (referredBy) {
      const referrer = await prisma.user.findUnique({ where: { referralCode: referredBy } })
      if (referrer) {
        await prisma.referral.create({
          data: {
            sourceUserId: referrer.id,
            targetUserId: user.id,
          },
        })
      }
    }

    const token = await signToken({
      id: user.id,
      email: user.email,
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

    return ok({ user: { id: user.id, name: user.name, email: user.email, role: user.role } }, 201)
  } catch (e) {
    return serverError(e)
  }
}
