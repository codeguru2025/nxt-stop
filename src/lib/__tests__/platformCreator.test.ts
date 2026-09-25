import { describe, it, expect, vi, beforeEach } from 'vitest'

let creatorSetting: string | null = null
const roles: Record<string, string> = {}
vi.mock('../db', () => ({
  prisma: {
    setting: { findUnique: async () => (creatorSetting ? { key: 'platform.creatorUserId', value: creatorSetting } : null) },
    user: { findUnique: async ({ where }: { where: { id: string } }) => (roles[where.id] ? { role: roles[where.id] } : null) },
  },
}))

import { isPlatformCreator, isCreatorProtected } from '../platformCreator'

beforeEach(() => {
  creatorSetting = 'creator'
  Object.assign(roles, { creator: 'admin', owner: 'admin' })
})

describe('isPlatformCreator', () => {
  it('is true only for the recorded creator account', async () => {
    expect(await isPlatformCreator('creator')).toBe(true)
    expect(await isPlatformCreator('owner')).toBe(false)
    expect(await isPlatformCreator(null)).toBe(false)
  })

  it('is false when no creator has been set', async () => {
    creatorSetting = null
    expect(await isPlatformCreator('creator')).toBe(false)
  })

  it('is false if the creator account is no longer an admin', async () => {
    roles.creator = 'customer'
    expect(await isPlatformCreator('creator')).toBe(false)
  })
})

describe('isCreatorProtected', () => {
  it('stops an owner changing the creator, but not the creator changing themselves or others', async () => {
    expect(await isCreatorProtected('creator', 'owner')).toBe(true)
    expect(await isCreatorProtected('creator', 'creator')).toBe(false)
    expect(await isCreatorProtected('owner', 'creator')).toBe(false)
  })
})
