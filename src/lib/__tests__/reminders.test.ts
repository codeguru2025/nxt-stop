import { describe, it, expect, vi } from 'vitest'

vi.mock('../db', () => ({ prisma: {} }))
vi.mock('../env', () => ({ env: {} }))

import { reminderDue } from '../sms'

// Venue time is UTC+2, so 10:00Z is noon at the venue
const at = (iso: string) => new Date(iso)

describe('reminderDue', () => {
  const event = at('2026-10-04T18:00:00Z') // Sun 4 Oct, 20:00 venue time

  it('reminds the day before from noon', () => {
    expect(reminderDue(event, at('2026-10-03T09:59:00Z'))).toBeNull()
    expect(reminderDue(event, at('2026-10-03T10:00:00Z'))).toBe('tomorrow')
    expect(reminderDue(event, at('2026-10-03T21:30:00Z'))).toBe('tomorrow') // 23:30 venue, still the 3rd
  })

  it('reminds on the day from 9am until it starts', () => {
    expect(reminderDue(event, at('2026-10-03T22:30:00Z'))).toBeNull() // 00:30 on the 4th
    expect(reminderDue(event, at('2026-10-04T07:00:00Z'))).toBe('today')
    expect(reminderDue(event, at('2026-10-04T18:00:00Z'))).toBeNull()
  })

  it('stays quiet for events further away', () => {
    expect(reminderDue(event, at('2026-10-02T12:00:00Z'))).toBeNull()
  })
})
