import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { prisma } from './db'
import type { User } from '@/generated/prisma/client'

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is not set')
  return new TextEncoder().encode(secret)
}

export type SessionUser = {
  id: string
  email: string
  name: string
  role: string
  referralCode: string
}

export async function signToken(payload: SessionUser): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .setIssuedAt()
    .sign(getJwtSecret())
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    return payload as unknown as SessionUser
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('nxt-session')?.value
  if (!token) return null
  return verifyToken(token)
}

export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession()
  if (!session) {
    throw new Error('Unauthorized')
  }
  return session
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireAuth()
  if (session.role !== 'admin') {
    throw new Error('Forbidden')
  }
  // Re-verify role from DB to prevent JWT role escalation attacks
  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { role: true } })
  if (!user || user.role !== 'admin') {
    throw new Error('Forbidden')
  }
  return session
}

export async function requireGateOrAdmin(): Promise<SessionUser> {
  const session = await requireAuth()
  if (!['admin', 'gate_staff'].includes(session.role)) {
    throw new Error('Forbidden')
  }
  return session
}
