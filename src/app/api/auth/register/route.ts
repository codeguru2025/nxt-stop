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

    const { name, phone, password, referralCode: referredBy } = await req.json()

    if (!name || !phone || !password) {
      return error('Name, phone number, and password are required')
    }
    if (password.length < 8) return error('Password must be at least 8 characters')

    const existingPhone = await prisma.user.findUnique({ where: { phone: phone.trim() } })
    if (existingPhone) return error('Phone number already registered')

    const passwordHash = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        phone: phone.trim(),
        passwordHash,
      },
    })

    // Handle referral
    if (referredBy) {
      const referrer = await prisma.user.findUnique({ where: { referralCode: referredBy } })
      if (referrer && referrer.id !== user.id) {
        await prisma.referral.create({
          data: { sourceUserId: referrer.id, targetUserId: user.id },
        })
      }
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

    return ok({ user: { id: user.id, name: user.name, phone: user.phone, role: user.role } }, 201)
  } catch (e) {
    return serverError(e)
  }
}
