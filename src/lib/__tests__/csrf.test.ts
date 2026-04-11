import { describe, it, expect } from 'vitest'
import { verifyCsrfFromHeaders } from '../csrf'

describe('verifyCsrfFromHeaders', () => {
  it('returns true for matching tokens', () => {
    const token = 'a'.repeat(64)
    expect(verifyCsrfFromHeaders(token, token)).toBe(true)
  })

  it('returns false for mismatched tokens', () => {
    expect(verifyCsrfFromHeaders('a'.repeat(64), 'b'.repeat(64))).toBe(false)
  })

  it('returns false when cookie is undefined', () => {
    expect(verifyCsrfFromHeaders(undefined, 'abc')).toBe(false)
  })

  it('returns false when header is null', () => {
    expect(verifyCsrfFromHeaders('abc', null)).toBe(false)
  })

  it('returns false for different-length strings', () => {
    expect(verifyCsrfFromHeaders('short', 'muchlongertoken')).toBe(false)
  })
})
