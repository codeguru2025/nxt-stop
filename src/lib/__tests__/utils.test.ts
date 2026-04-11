import { describe, it, expect } from 'vitest'
import { slugify, formatCurrency, truncate, getInitials, parseReferralCode, buildReferralUrl } from '../utils'

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
