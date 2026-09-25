import { prisma } from './db'

/**
 * The platform creator: one account above the platform owners. It has every owner privilege
 * plus the creator-only ones (setting SMS credits), and no other admin can change its account.
 * Stored as a Setting row (no User column), and set ONLY by
 * prisma/scripts/seed-platform-creator.ts — no API route writes this key.
 */
export const PLATFORM_CREATOR_KEY = 'platform.creatorUserId'

export async function platformCreatorId(): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key: PLATFORM_CREATOR_KEY } }).catch(() => null)
  return row?.value || null
}

/** True only for the creator's account, and only while it is still an admin. */
export async function isPlatformCreator(userId: string | null | undefined): Promise<boolean> {
  if (!userId || (await platformCreatorId()) !== userId) return false
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } }).catch(() => null)
  return user?.role === 'admin'
}

/** Other admins — owners included — may not edit, reset or revoke the creator's account. */
export async function isCreatorProtected(targetUserId: string, actorId: string): Promise<boolean> {
  return targetUserId !== actorId && (await platformCreatorId()) === targetUserId
}
