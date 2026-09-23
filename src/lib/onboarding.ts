import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from './db'
import type { Prisma } from '@/generated/prisma/client'

// Characters chosen to avoid visual ambiguity (no 0/O, 1/I/l) since this gets typed
// once by hand off an email.
const OTP_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateOneTimePassword(length = 10): string {
  const bytes = crypto.randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += OTP_ALPHABET[bytes[i] % OTP_ALPHABET.length]
  }
  return out
}

/** First token / remainder split — same convention as prisma/scripts/backfill-user-names.ts. */
export function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim()
  const spaceIdx = trimmed.indexOf(' ')
  if (spaceIdx === -1) return { firstName: trimmed || 'Guest', lastName: '' }
  return { firstName: trimmed.slice(0, spaceIdx), lastName: trimmed.slice(spaceIdx + 1).trim() }
}

export type NewAccountInput = {
  phone: string
  firstName: string
  lastName: string
  // Optional only for cash sales at the gate, where buyers may not have one; those
  // accounts are claimed later through the admin-assisted phone reset.
  email?: string | null
  homeTown?: string
  isWhatsApp?: boolean
}

/**
 * Creates a User with a system-issued one-time password. `mustResetPassword` is set
 * so the account cannot be used normally until POST /api/auth/set-password is called —
 * that route is the only place in the app that ever clears the flag.
 */
export async function createAccountWithOneTimePassword(
  input: NewAccountInput,
  db: Prisma.TransactionClient = prisma
): Promise<{ user: Awaited<ReturnType<typeof prisma.user.create>>; plaintextPassword: string }> {
  const plaintextPassword = generateOneTimePassword()
  const passwordHash = await bcrypt.hash(plaintextPassword, 10)
  const name = `${input.firstName} ${input.lastName}`.trim()

  const user = await db.user.create({
    data: {
      phone: input.phone,
      name,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email ?? null,
      homeTown: input.homeTown ?? null,
      isWhatsApp: input.isWhatsApp ?? true,
      passwordHash,
      mustResetPassword: true,
    },
  })

  return { user, plaintextPassword }
}
