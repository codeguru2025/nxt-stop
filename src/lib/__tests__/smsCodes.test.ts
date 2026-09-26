import { describe, it, expect, vi, beforeEach } from 'vitest'

type Row = { id: string; purpose: string; phone: string; userId: string; codeHash: string; attempts: number; expiresAt: Date; usedAt: Date | null; createdAt: Date }
let rows: Row[] = []

const matches = (r: Row, w: Record<string, unknown>) =>
  (w.purpose === undefined || r.purpose === w.purpose) &&
  (w.phone === undefined || r.phone === w.phone) &&
  (w.userId === undefined || r.userId === w.userId) &&
  (!('usedAt' in w) || r.usedAt === w.usedAt) &&
  (!w.expiresAt || r.expiresAt > (w.expiresAt as { gt: Date }).gt) &&
  (!w.createdAt || r.createdAt > (w.createdAt as { gt: Date }).gt)

vi.mock('../db', () => ({
  prisma: {
    smsCode: {
      count: async ({ where }: { where: Record<string, unknown> }) => rows.filter(r => matches(r, where)).length,
      create: async ({ data }: { data: Omit<Row, 'id' | 'attempts' | 'usedAt' | 'createdAt'> }) => {
        rows.push({ ...data, id: String(rows.length + 1), attempts: 0, usedAt: null, createdAt: new Date() })
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) => rows.filter(r => matches(r, where)).at(-1) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: { attempts: { increment: number } } }) => {
        rows.find(r => r.id === where.id)!.attempts += data.attempts.increment
      },
      updateMany: async ({ where, data }: { where: { id: string; usedAt: null }; data: { usedAt: Date } }) => {
        const r = rows.find(x => x.id === where.id && x.usedAt === null)
        if (r) r.usedAt = data.usedAt
        return { count: r ? 1 : 0 }
      },
    },
  },
}))
vi.mock('../env', () => ({ env: { JWT_SECRET: 'test-secret' } }))

import { generateCode, issueCode, redeemCode } from '../smsCodes'

beforeEach(() => { rows = [] })

describe('SMS codes', () => {
  it('generates six digits', () => {
    for (let i = 0; i < 50; i++) expect(generateCode()).toMatch(/^\d{6}$/)
  })

  it('stores only a hash, and the right code works once', async () => {
    const issued = await issueCode('login', '+263771234567', 'u1')
    if (!issued.ok) throw new Error('not issued')
    expect(rows[0].codeHash).not.toContain(issued.code)
    await expect(redeemCode('login', { phone: '+263771234567' }, issued.code)).resolves.toEqual({ userId: 'u1', phone: '+263771234567' })
    await expect(redeemCode('login', { phone: '+263771234567' }, issued.code)).resolves.toBeNull()
  })

  it('does not accept a code for another purpose', async () => {
    const issued = await issueCode('phone-change', '+263771234567', 'u1')
    if (!issued.ok) throw new Error('not issued')
    await expect(redeemCode('login', { phone: '+263771234567' }, issued.code)).resolves.toBeNull()
    await expect(redeemCode('phone-change', { userId: 'u1' }, issued.code)).resolves.not.toBeNull()
  })

  it('dies after five wrong guesses, even for the right code', async () => {
    const issued = await issueCode('login', '+263771234567', 'u1')
    if (!issued.ok) throw new Error('not issued')
    const wrong = issued.code === '000000' ? '111111' : '000000'
    for (let i = 0; i < 5; i++) await redeemCode('login', { phone: '+263771234567' }, wrong)
    await expect(redeemCode('login', { phone: '+263771234567' }, issued.code)).resolves.toBeNull()
  })

  it('refuses expired codes', async () => {
    const issued = await issueCode('login', '+263771234567', 'u1')
    if (!issued.ok) throw new Error('not issued')
    rows[0].expiresAt = new Date(Date.now() - 1000)
    await expect(redeemCode('login', { phone: '+263771234567' }, issued.code)).resolves.toBeNull()
  })

  it('sends at most three codes to a number per 15 minutes', async () => {
    for (let i = 0; i < 3; i++) expect((await issueCode('login', '+263771234567', 'u1')).ok).toBe(true)
    expect((await issueCode('login', '+263771234567', 'u1')).ok).toBe(false)
    expect((await issueCode('login', '+263779999999', 'u2')).ok).toBe(true)
  })
})
