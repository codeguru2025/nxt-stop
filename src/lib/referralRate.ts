import { prisma } from './db'
import type { Prisma } from '@/generated/prisma/client'

/** Used when no active PointsConfig row exists. */
export const DEFAULT_REFERRAL_PERCENT = 10

/**
 * The live rewards config: the newest active PointsConfig row. fulfillOrder pays link
 * rewards from this same row, so every page quoting the % reads it through here too.
 */
export function activeRewardsConfig(db: Prisma.TransactionClient = prisma) {
  return db.pointsConfig.findFirst({ where: { active: true }, orderBy: { updatedAt: 'desc' } })
}

/** % of each purchase paid to whoever's link it came through. */
export async function getReferralPercent(db: Prisma.TransactionClient = prisma): Promise<number> {
  const config = await activeRewardsConfig(db)
  return Number(config?.referralPercentage ?? DEFAULT_REFERRAL_PERCENT)
}
