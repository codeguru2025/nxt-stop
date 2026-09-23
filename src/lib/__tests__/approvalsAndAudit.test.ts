import { describe, it, expect } from 'vitest'
import { publicAvailability, eventSellingFast } from '../publicTickets'
import { describeAuditEntry, auditUserIds } from '../auditDescribe'

describe('publicAvailability — the public never sees sales numbers', () => {
  it('only exposes flags, never sold or capacity', () => {
    const a = publicAvailability(500, 123)
    expect(Object.keys(a).sort()).toEqual(['almostSoldOut', 'maxPerOrder', 'soldOut'])
    expect(a).toEqual({ soldOut: false, almostSoldOut: false, maxPerOrder: 10 })
  })

  it('flags almost sold out at 20 or fewer left, and caps the order at what is left', () => {
    expect(publicAvailability(100, 80)).toEqual({ soldOut: false, almostSoldOut: true, maxPerOrder: 10 })
    expect(publicAvailability(100, 97)).toEqual({ soldOut: false, almostSoldOut: true, maxPerOrder: 3 })
  })

  it('sold out (and oversold) means nothing can be ordered', () => {
    expect(publicAvailability(100, 100)).toEqual({ soldOut: true, almostSoldOut: false, maxPerOrder: 0 })
    expect(publicAvailability(100, 104)).toEqual({ soldOut: true, almostSoldOut: false, maxPerOrder: 0 })
  })

  it('"Selling fast" once more than 80% of all tickets are gone', () => {
    expect(eventSellingFast([{ capacity: 100, sold: 80 }])).toBe(false)
    expect(eventSellingFast([{ capacity: 100, sold: 81 }])).toBe(true)
    expect(eventSellingFast([])).toBe(false)
  })
})

describe('describeAuditEntry — plain language a non-technical owner can read', () => {
  const names = { admin1: 'Tino', admin2: 'Rudo', buyer1: 'Tendai Moyo' }
  const row = (action: string, extra: Partial<Parameters<typeof describeAuditEntry>[0]> = {}) =>
    ({ action, entityType: 'User', entityId: null, before: null, after: null, actorId: 'admin1', actorRole: 'admin', ...extra })

  it('approval requests list each change', () => {
    const d = describeAuditEntry(row('change.requested', {
      entityType: 'Event',
      after: { title: 'Edit event “NXTSTOP SESSIONS”', changes: [{ label: 'Ticket “VIP GATE” — price', from: '$50.00', to: '$60.00' }] },
    }), names)
    expect(d.summary).toBe('Tino asked for approval to: Edit event “NXTSTOP SESSIONS”')
    expect(d.details).toEqual(['Ticket “VIP GATE” — price: $50.00 → $60.00'])
    expect(d.category).toBe('approval')
  })

  it('approvals and rejections say who asked, and rejections are flagged', () => {
    const ok = describeAuditEntry(row('change.approved', { actorId: 'admin2', after: { title: 'Delete event “Old Night”', requestedBy: 'Tino' } }), names)
    expect(ok.summary).toBe('Rudo approved: Delete event “Old Night” (asked by Tino) — it is now live')
    const no = describeAuditEntry(row('change.rejected', { actorId: 'admin2', after: { title: 'Mark order #1 as paid', requestedBy: 'Tino', note: 'No proof of payment' } }), names)
    expect(no.alert).toBe(true)
    expect(no.details).toEqual(['Reason given: “No proof of payment”'])
  })

  it('failed logins are flagged and name the account when known', () => {
    const d = describeAuditEntry(row('auth.login.failure', { actorId: null, entityId: 'admin2' }), names)
    expect(d.summary).toBe("Failed login: someone entered the wrong password for Rudo's account")
    expect(d.alert).toBe(true)
  })

  it('cash sales name the buyer', () => {
    const d = describeAuditEntry(row('ticket.physical.activate', { entityType: 'Ticket', after: { buyerId: 'buyer1', orderNumber: 'ORD-1', accountCreated: true } }), names)
    expect(d.summary).toBe('Tino sold a printed ticket for cash to Tendai Moyo')
  })

  it('admin access changes use section names, not codes', () => {
    const d = describeAuditEntry(row('admin.update', { entityId: 'admin2', before: { capabilities: ['events'] }, after: { capabilities: ['events', 'store'] } }), names)
    expect(d.summary).toBe('Tino changed the admin account of Rudo')
    expect(d.details[0]).toBe('Access changed from: Events → to: Events, Store')
  })

  it('unknown actions still read as words, not codes', () => {
    expect(describeAuditEntry(row('founder.photo.update', { entityType: 'Founder' }), names).summary).toBe('Tino: founder photo update (Founder)')
  })

  it('collects every user id that needs a name', () => {
    expect(auditUserIds(row('ticket.physical.activate', { after: { buyerId: 'buyer1' } })).sort()).toEqual(['admin1', 'buyer1'])
  })
})
