import { describe, it, expect, vi, beforeEach } from 'vitest'

const findUnique = vi.fn()
vi.mock('../db', () => ({ prisma: { setting: { findUnique: (...a: unknown[]) => findUnique(...a) } } }))

import { isSmsSwitchedOff, smsSwitchedOff } from '../smsSettings'

beforeEach(() => { findUnique.mockReset() })

describe('smsSwitchedOff', () => {
  it('starts with only payment confirmation and account access on', async () => {
    findUnique.mockResolvedValue(null)
    for (const on of ['order.paid', 'account.welcome', 'lineup.login', 'auth.login-code']) {
      expect(await isSmsSwitchedOff(on)).toBe(false)
    }
    for (const off of ['order.pending', 'order.refunded', 'ticket.transfer', 'event.reminder-today', 'referral.reward']) {
      expect(await isSmsSwitchedOff(off)).toBe(true)
    }
  })

  it('never switches off the phone-change code', async () => {
    findUnique.mockResolvedValue({ value: JSON.stringify(['auth.phone-change-code', 'order.paid']) })
    expect(await isSmsSwitchedOff('auth.phone-change-code')).toBe(false)
    expect([...await smsSwitchedOff()]).toEqual(['order.paid'])
  })

  it('uses the saved choice once an admin has made one', async () => {
    findUnique.mockResolvedValue({ value: '[]' })
    expect(await isSmsSwitchedOff('event.reminder-tomorrow')).toBe(false)
  })
})
