import { describe, it, expect } from 'vitest'
import { canIssuePassword, hasOwnPassword, type PasswordAccount } from '../participantPasswords'

const lineupOnly: PasswordAccount = { mustResetPassword: true, passwordSetAt: null, role: 'customer', _count: { orders: 0, tickets: 0 } }

describe('line-up one-time passwords', () => {
  it('can issue one for an account made only for the line-up', () => {
    expect(hasOwnPassword(lineupOnly)).toBe(false)
    expect(canIssuePassword(lineupOnly)).toBe(true)
  })

  it('never resets someone who chose their own password', () => {
    const u = { ...lineupOnly, mustResetPassword: false, passwordSetAt: new Date() }
    expect(hasOwnPassword(u)).toBe(true)
    expect(canIssuePassword(u)).toBe(false)
  })

  it('never resets an admin-created partner login (password set by an admin)', () => {
    const u = { ...lineupOnly, role: 'partner', mustResetPassword: false }
    expect(hasOwnPassword(u)).toBe(true)
    expect(canIssuePassword(u)).toBe(false)
  })

  it('never resets a customer who has bought something', () => {
    expect(canIssuePassword({ ...lineupOnly, _count: { orders: 1, tickets: 0 } })).toBe(false)
    expect(canIssuePassword({ ...lineupOnly, _count: { orders: 0, tickets: 2 } })).toBe(false)
  })

  it('never resets staff accounts', () => {
    expect(canIssuePassword({ ...lineupOnly, role: 'admin' })).toBe(false)
    expect(canIssuePassword({ ...lineupOnly, role: 'gate_staff' })).toBe(false)
  })
})
