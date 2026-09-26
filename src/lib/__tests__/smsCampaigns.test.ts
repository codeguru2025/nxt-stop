import { describe, it, expect, vi, beforeEach } from 'vitest'

const campaign = { status: 'sending' as string, sent: 0, failed: 0, stopReason: null as string | null }
const findUsers = vi.fn()
vi.mock('../db', () => ({
  prisma: {
    user: { findMany: (...a: unknown[]) => findUsers(...a) },
    event: { findUnique: async () => null },
    smsCampaign: {
      count: async () => 0,
      create: async () => ({ id: 'c1' }),
      findUnique: async () => ({ status: campaign.status }),
      update: async ({ data }: { data: Partial<typeof campaign> }) => Object.assign(campaign, data),
      updateMany: async ({ where, data }: { where: { status?: string }; data: Partial<typeof campaign> }) => {
        if (where.status && where.status !== campaign.status) return { count: 0 }
        Object.assign(campaign, data)
        return { count: 1 }
      },
    },
  },
}))
const send = vi.fn()
vi.mock('../sms', () => ({ sendSms: (...a: unknown[]) => send(...a) }))
vi.mock('../smsCredits', () => ({ smsCredits: async () => ({ bought: 100, used: 0, remaining: 100 }) }))
vi.mock('../referralRate', () => ({ getReferralPercent: async () => 10 }))

import { prepareCampaign, startCampaign, stopCampaign } from '../smsCampaigns'

const people = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `u${i}`, phone: `+2637700000${String(i).padStart(2, '0')}`, referralCode: `code${i}` }))
const settle = () => new Promise(r => setTimeout(r, 20))

beforeEach(() => {
  Object.assign(campaign, { status: 'sending', sent: 0, failed: 0, stopReason: null })
  findUsers.mockReset()
  send.mockReset()
})

describe('SMS campaigns', () => {
  it('win-back goes to opted-in customers only and costs one credit each', async () => {
    findUsers.mockResolvedValue(people(3))
    const p = await prepareCampaign({ template: 'win-back' })
    if (!p.ok) throw new Error(p.error)
    expect(findUsers.mock.calls[0][0].where).toMatchObject({ smsOptOutAt: null, role: { in: ['customer', 'partner'] } })
    expect(p.recipients).toHaveLength(3)
    expect(p.creditsNeeded).toBe(3)
  })

  it('event messages need an event', async () => {
    await expect(prepareCampaign({ template: 'new-event' })).resolves.toEqual({ ok: false, error: 'Pick an event' })
  })

  it('sends as promotional to everyone and finishes as done', async () => {
    findUsers.mockResolvedValue(people(10))
    send.mockResolvedValue('sent')
    const p = await prepareCampaign({ template: 'win-back' })
    if (!p.ok) throw new Error(p.error)
    await startCampaign(p, { id: 'a1', name: 'Admin' })
    await settle()
    expect(send).toHaveBeenCalledTimes(10)
    expect(send.mock.calls[0][2]).toEqual({ kind: 'promotional', purpose: 'campaign.win-back', reference: 'c1' })
    expect(campaign).toMatchObject({ status: 'done', sent: 10, failed: 0 })
  })

  it('stops when credits run out', async () => {
    findUsers.mockResolvedValue(people(12))
    send.mockResolvedValueOnce('sent').mockResolvedValue('no_credit')
    const p = await prepareCampaign({ template: 'win-back' })
    if (!p.ok) throw new Error(p.error)
    await startCampaign(p, { id: 'a1', name: 'Admin' })
    await settle()
    expect(send).toHaveBeenCalledTimes(4) // the first batch, then no more
    expect(campaign).toMatchObject({ status: 'stopped', stopReason: 'SMS credits ran out', sent: 1, failed: 3 })
  })

  it('an admin stop halts it before the next batch', async () => {
    findUsers.mockResolvedValue(people(12))
    send.mockImplementation(async () => { await stopCampaign('c1'); return 'sent' })
    const p = await prepareCampaign({ template: 'win-back' })
    if (!p.ok) throw new Error(p.error)
    await startCampaign(p, { id: 'a1', name: 'Admin' })
    await settle()
    expect(send).toHaveBeenCalledTimes(4)
    expect(campaign).toMatchObject({ status: 'stopped', stopReason: 'Stopped by an admin', sent: 4 })
  })
})
