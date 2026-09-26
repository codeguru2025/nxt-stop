import { cookies } from 'next/headers'
import { signToken, type SessionUser } from './auth'

/** Signs the user in on this browser — same cookie as POST /api/auth/login sets. */
export async function startSession(user: SessionUser): Promise<void> {
  const token = await signToken({
    id: user.id, phone: user.phone, name: user.name, role: user.role, referralCode: user.referralCode,
  })
  const cookieStore = await cookies()
  cookieStore.set('nxt-session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
}
