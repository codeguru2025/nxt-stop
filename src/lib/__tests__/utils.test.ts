import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { slugify, formatCurrency, truncate, getInitials, parseReferralCode, buildReferralUrl, getEventTimePhase, eventLocalInputToUtc, utcToEventLocalInput, formatDate, eventDayStartUtc, eventEndTime, ticketSalesClosedReason, ticketChannelWindow, lowestOnSalePrice } from '../utils'

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('NXT STOP Live')).toBe('nxt-stop-live')
  })

  it('strips special characters', () => {
    expect(slugify('DJ Fire @ Club 2026!')).toBe('dj-fire-club-2026')
  })

  it('collapses multiple hyphens', () => {
    expect(slugify('hello   ---  world')).toBe('hello-world')
  })

  it('trims leading/trailing hyphens', () => {
    expect(slugify('--hello--')).toBe('hello')
  })

  it('handles empty string', () => {
    expect(slugify('')).toBe('')
  })
})

describe('formatCurrency', () => {
  it('formats USD by default', () => {
    expect(formatCurrency(10)).toBe('$10.00')
  })

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })

  it('handles decimals correctly', () => {
    expect(formatCurrency(15.5)).toBe('$15.50')
  })

  it('handles large numbers', () => {
    const formatted = formatCurrency(1234567.89)
    expect(formatted).toContain('1,234,567.89')
  })
})

describe('truncate', () => {
  it('returns short strings unchanged', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })

  it('truncates long strings and adds ellipsis', () => {
    expect(truncate('hello world', 5)).toBe('hello...')
  })

  it('handles exact boundary', () => {
    expect(truncate('hello', 5)).toBe('hello')
  })
})

describe('getInitials', () => {
  it('returns first two initials', () => {
    expect(getInitials('John Doe')).toBe('JD')
  })

  it('handles single name', () => {
    expect(getInitials('Madonna')).toBe('M')
  })

  it('handles three names', () => {
    expect(getInitials('John Michael Doe')).toBe('JM')
  })
})

describe('parseReferralCode', () => {
  it('extracts code from referral URL', () => {
    expect(parseReferralCode('https://example.com/r/ABC123')).toBe('ABC123')
  })

  it('returns null for non-referral URLs', () => {
    expect(parseReferralCode('https://example.com/events')).toBeNull()
  })

  it('returns null for invalid URLs', () => {
    expect(parseReferralCode('not-a-url')).toBeNull()
  })

  it('returns null if /r/ has no following segment', () => {
    expect(parseReferralCode('https://example.com/r/')).toBeNull()
  })
})

describe('buildReferralUrl', () => {
  it('builds URL with code', () => {
    const url = buildReferralUrl('ABC123')
    expect(url).toContain('/r/ABC123')
  })
})

describe('event timezone (CAT, UTC+2) handling', () => {
  it('parses a datetime-local input as CAT and stores the correct UTC instant', () => {
    // Admin enters 20:00 venue time → must persist as 18:00 UTC.
    expect(eventLocalInputToUtc('2026-06-15T20:00').toISOString()).toBe('2026-06-15T18:00:00.000Z')
  })

  it('round-trips datetime-local → UTC → datetime-local without drift', () => {
    const local = '2026-06-15T20:00'
    expect(utcToEventLocalInput(eventLocalInputToUtc(local))).toBe(local)
  })

  it('renders a stored UTC instant in CAT wall-clock, not runtime-local', () => {
    // 18:00 UTC is 20:00 in Harare regardless of where this runs.
    expect(formatDate('2026-06-15T18:00:00Z', 'h:mm a')).toBe('8:00 PM')
  })

  it('returns empty string for a missing edit value', () => {
    expect(utcToEventLocalInput(null)).toBe('')
    expect(utcToEventLocalInput(undefined)).toBe('')
  })

  it('returns an Invalid Date for malformed input (so callers can reject it)', () => {
    expect(isNaN(eventLocalInputToUtc('').getTime())).toBe(true)
    expect(isNaN(eventLocalInputToUtc('not-a-date').getTime())).toBe(true)
    expect(isNaN(eventLocalInputToUtc('2026-13-40T99:99').getTime())).toBe(true)
  })

  it('tolerates a seconds component in the input', () => {
    expect(eventLocalInputToUtc('2026-06-15T20:00:30').toISOString()).toBe('2026-06-15T18:00:00.000Z')
  })
})

describe('eventDayStartUtc (advance/gate ticket sales-window boundary)', () => {
  it('resolves to CAT midnight (UTC-2) on the event date', () => {
    // Event at 20:00 CAT on the 15th → local midnight that day is 22:00 UTC on the 14th.
    expect(eventDayStartUtc('2026-06-15T18:00:00Z').toISOString()).toBe('2026-06-14T22:00:00.000Z')
  })

  it('is stable for any wall-clock time on the same CAT calendar day', () => {
    const morning = eventDayStartUtc('2026-06-15T04:00:00Z') // 06:00 CAT on the 15th
    const night = eventDayStartUtc('2026-06-15T21:00:00Z')   // 23:00 CAT on the 15th
    expect(morning.toISOString()).toBe(night.toISOString())
  })

  it('accepts a Date instance as well as a string', () => {
    expect(eventDayStartUtc(new Date('2026-06-15T18:00:00Z')).toISOString()).toBe('2026-06-14T22:00:00.000Z')
  })
})

describe('getEventTimePhase', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns upcoming before start', () => {
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'))
    expect(getEventTimePhase('2026-06-15T20:00:00Z')).toBe('upcoming')
  })

  it('returns live between start and endDate', () => {
    vi.setSystemTime(new Date('2026-06-15T21:00:00Z'))
    expect(getEventTimePhase('2026-06-15T20:00:00Z', '2026-06-16T04:00:00Z')).toBe('live')
  })

  it('returns ended after endDate', () => {
    vi.setSystemTime(new Date('2026-06-16T10:00:00Z'))
    expect(getEventTimePhase('2026-06-15T20:00:00Z', '2026-06-16T04:00:00Z')).toBe('ended')
  })

  it('uses default duration when endDate missing', () => {
    vi.setSystemTime(new Date('2026-06-15T23:00:00Z'))
    expect(getEventTimePhase('2026-06-15T20:00:00Z')).toBe('live')
    vi.setSystemTime(new Date('2026-06-16T06:00:00Z'))
    expect(getEventTimePhase('2026-06-15T20:00:00Z')).toBe('ended')
  })
})

describe('eventEndTime', () => {
  it('uses endDate when set', () => {
    expect(eventEndTime('2026-06-15T18:00:00Z', '2026-06-16T02:00:00Z').toISOString()).toBe('2026-06-16T02:00:00.000Z')
  })

  it('defaults to 8 hours after start — same rule the event page uses', () => {
    expect(eventEndTime('2026-06-15T18:00:00Z', null).toISOString()).toBe('2026-06-16T02:00:00.000Z')
  })
})

describe('ticketSalesClosedReason (online checkout + cash sales at the desk)', () => {
  // Event starts 20:00 CAT on 15 June (18:00Z); event day begins 00:00 CAT = 14 June 22:00Z
  const event = { date: '2026-06-15T18:00:00Z', endDate: '2026-06-16T00:00:00Z', status: 'published' }
  const at = (iso: string) => new Date(iso)

  it('advance tickets sell before event day and stop at midnight CAT', () => {
    expect(ticketSalesClosedReason(event, 'advance', at('2026-06-14T21:59:00Z'))).toBeNull()
    expect(ticketSalesClosedReason(event, 'advance', at('2026-06-14T22:00:00Z'))).toMatch(/Advance sales have closed/)
  })

  it('gate tickets are blocked before event day and sell from midnight CAT', () => {
    expect(ticketSalesClosedReason(event, 'gate', at('2026-06-14T21:59:00Z'))).toMatch(/goes on sale on the day/)
    expect(ticketSalesClosedReason(event, 'gate', at('2026-06-14T22:00:00Z'))).toBeNull()
  })

  it('"both" tickets sell any time until the event ends', () => {
    expect(ticketSalesClosedReason(event, 'both', at('2026-06-10T10:00:00Z'))).toBeNull()
    expect(ticketSalesClosedReason(event, 'both', at('2026-06-15T23:59:00Z'))).toBeNull()
  })

  it('nothing sells once the end time passes', () => {
    for (const channel of ['both', 'gate', 'advance']) {
      expect(ticketSalesClosedReason(event, channel, at('2026-06-16T00:01:00Z'))).toMatch(/event has ended/)
    }
  })

  it('nothing sells for an ended or cancelled event, even before its end time', () => {
    expect(ticketSalesClosedReason({ ...event, status: 'cancelled' }, 'both', at('2026-06-10T10:00:00Z'))).toMatch(/closed/)
    expect(ticketSalesClosedReason({ ...event, status: 'ended' }, 'gate', at('2026-06-15T19:00:00Z'))).toMatch(/closed/)
  })
})

describe('NXTSTOP SESSIONS (19 Dec 2026, 12:00 PM → 12:00 AM CAT) — sales run right up to the end time', () => {
  const event = { date: '2026-12-19T12:00:00+02:00', endDate: '2026-12-20T00:00:00+02:00', status: 'published' }
  const at = (iso: string) => new Date(iso)

  it('tickets can be bought while the event is on', () => {
    for (const time of ['2026-12-19T12:00:00+02:00', '2026-12-19T18:30:00+02:00', '2026-12-19T23:59:00+02:00']) {
      expect(ticketSalesClosedReason(event, 'both', at(time))).toBeNull()
      expect(ticketSalesClosedReason(event, 'gate', at(time))).toBeNull()
    }
  })

  it('a "live" status does not stop sales', () => {
    expect(ticketSalesClosedReason({ ...event, status: 'live' }, 'both', at('2026-12-19T20:00:00+02:00'))).toBeNull()
  })

  it('sales stop the moment midnight passes', () => {
    expect(ticketSalesClosedReason(event, 'both', at('2026-12-20T00:00:01+02:00'))).toMatch(/event has ended/)
    expect(ticketSalesClosedReason(event, 'gate', at('2026-12-20T00:00:01+02:00'))).toMatch(/event has ended/)
  })

  it('the event page shows it as live during the event and ended after midnight', () => {
    vi.useFakeTimers()
    vi.setSystemTime(at('2026-12-19T21:00:00+02:00'))
    expect(getEventTimePhase(event.date, event.endDate)).toBe('live')
    vi.setSystemTime(at('2026-12-20T00:00:01+02:00'))
    expect(getEventTimePhase(event.date, event.endDate)).toBe('ended')
    vi.useRealTimers()
  })
})

describe('ticket greying on the event page (NXTSTOP SESSIONS, 19 Dec 2026)', () => {
  const date = '2026-12-19T12:00:00+02:00'
  const before = new Date('2026-12-18T23:59:00+02:00') // day before, 11:59 PM CAT
  const onDay = new Date('2026-12-19T00:00:00+02:00')  // midnight CAT, event day
  const types = [
    { name: 'General Advance', price: 10, soldOut: false, salesChannel: 'advance' },
    { name: 'General Gate', price: 20, soldOut: false, salesChannel: 'gate' },
    { name: 'VIP Advance', price: 40, soldOut: true, salesChannel: 'advance' },
  ]

  it('gate tickets are greyed out before event day and open at midnight', () => {
    expect(ticketChannelWindow(date, 'gate', before)).toBe('gate_not_yet')
    expect(ticketChannelWindow(date, 'gate', onDay)).toBe('open')
  })

  it('advance tickets are open before event day and greyed out from midnight', () => {
    expect(ticketChannelWindow(date, 'advance', before)).toBe('open')
    expect(ticketChannelWindow(date, 'advance', onDay)).toBe('advance_closed')
  })

  it('"both" tickets are never greyed out by the window', () => {
    expect(ticketChannelWindow(date, 'both', before)).toBe('open')
    expect(ticketChannelWindow(date, 'both', onDay)).toBe('open')
  })

  it('"From" price only counts tickets you can buy right now', () => {
    expect(lowestOnSalePrice(date, types, before)).toBe(10) // advance, gate not yet on sale
    expect(lowestOnSalePrice(date, types, onDay)).toBe(20)  // advance closed → gate price
  })

  it('"From" price skips sold-out tickets and falls back to the cheapest when nothing is on sale', () => {
    expect(lowestOnSalePrice(date, [types[2], { ...types[1], price: 60 }], before)).toBe(40) // nothing buyable → cheapest
    expect(lowestOnSalePrice(date, [types[2], { ...types[0], price: 45 }], before)).toBe(45) // sold-out $40 skipped
    expect(lowestOnSalePrice(date, [], before)).toBe(0)
  })
})
