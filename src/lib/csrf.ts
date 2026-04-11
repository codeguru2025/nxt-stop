import { cookies } from 'next/headers'
import crypto from 'crypto'

const CSRF_COOKIE = 'csrf-token'
const CSRF_HEADER = 'x-csrf-token'
const TOKEN_LENGTH = 32

export async function getCsrfToken(): Promise<string> {
  const cookieStore = await cookies()
  const existing = cookieStore.get(CSRF_COOKIE)?.value
  if (existing) return existing

  const token = crypto.randomBytes(TOKEN_LENGTH).toString('hex')
  cookieStore.set(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24,
  })
  return token
}

export function verifyCsrfFromHeaders(
  csrfCookie: string | undefined,
  csrfHeader: string | null
): boolean {
  if (!csrfCookie || !csrfHeader) return false
  if (csrfCookie.length !== csrfHeader.length) return false
  const a = Buffer.from(csrfCookie)
  const b = Buffer.from(csrfHeader)
  return crypto.timingSafeEqual(a, b)
}

export { CSRF_COOKIE, CSRF_HEADER }
