import crypto from 'crypto'
import { prisma } from './db'
import { env } from './env'

export type SmsCodePurpose = 'login' | 'phone-change'

export const CODE_TTL_MINUTES = 10
const MAX_ATTEMPTS = 5
// Per phone number, on top of the per-IP auth limit: each code costs a credit
const MAX_CODES_PER_WINDOW = 3
const WINDOW_MS = 15 * 60 * 1000

/** Keyed with the JWT secret, so a leaked table alone doesn't reveal a 6-digit code. */
function hashCode(code: string): string {
  return crypto.createHmac('sha256', env.JWT_SECRET).update(code).digest('hex')
}

export function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
}

/** Stores a new code for `phone`, or refuses when too many were sent there recently. */
export async function issueCode(
  purpose: SmsCodePurpose, phone: string, userId: string,
): Promise<{ ok: true; code: string } | { ok: false }> {
  const recent = await prisma.smsCode.count({
    where: { phone, purpose, createdAt: { gt: new Date(Date.now() - WINDOW_MS) } },
  })
  if (recent >= MAX_CODES_PER_WINDOW) return { ok: false }

  const code = generateCode()
  await prisma.smsCode.create({
    data: {
      purpose, phone, userId, codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
    },
  })
  return { ok: true, code }
}

/**
 * Checks `code` against the newest live code matching `where`. A wrong guess counts
 * against that code; a right one uses it up. Returns who it was for, or null.
 */
export async function redeemCode(
  purpose: SmsCodePurpose, where: { phone: string } | { userId: string }, code: string,
): Promise<{ userId: string; phone: string } | null> {
  const record = await prisma.smsCode.findFirst({
    where: { purpose, ...where, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })
  if (!record || record.attempts >= MAX_ATTEMPTS) return null

  const given = Buffer.from(hashCode(code.trim()))
  const stored = Buffer.from(record.codeHash)
  if (given.length !== stored.length || !crypto.timingSafeEqual(given, stored)) {
    await prisma.smsCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } })
    return null
  }

  // Guarded on usedAt so two requests racing with the same code can't both succeed
  const { count } = await prisma.smsCode.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } })
  return count === 1 ? { userId: record.userId, phone: record.phone } : null
}
