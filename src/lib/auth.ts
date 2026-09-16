import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { prisma } from './db'
import { env } from './env'

function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET)
}

export type SessionUser = {
  id: string
  phone: string
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
  // Re-verify role from DB — same as requireAdmin — so a downgraded user's JWT can't be used
  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { role: true } })
  if (!user || !['admin', 'gate_staff'].includes(user.role)) {
    throw new Error('Forbidden')
  }
  return session
}

export type { AdminCapability } from './adminCapabilities'
export { ADMIN_CAPABILITIES, isAdminCapability } from './adminCapabilities'
import type { AdminCapability } from './adminCapabilities'

// Requires the caller to be an admin AND hold this specific capability.
// Re-verifies both role and capabilities from the DB (never trusts the JWT for either).
export async function requireCapability(capability: AdminCapability): Promise<SessionUser> {
  const session = await requireAuth()
  if (session.role !== 'admin') throw new Error('Forbidden')
  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { role: true, capabilities: true } })
  if (!user || user.role !== 'admin' || !user.capabilities.includes(capability)) {
    throw new Error('Forbidden')
  }
  return session
}

// Same as requireCapability, but passes if the admin holds ANY of the listed capabilities —
// for routes shared by more than one admin-panel section (e.g. event media serves both
// the Events editor and the Past Videos page).
export async function requireAnyCapability(capabilities: AdminCapability[]): Promise<SessionUser> {
  const session = await requireAuth()
  if (session.role !== 'admin') throw new Error('Forbidden')
  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { role: true, capabilities: true } })
  if (!user || user.role !== 'admin' || !capabilities.some((c) => user.capabilities.includes(c))) {
    throw new Error('Forbidden')
  }
  return session
}
