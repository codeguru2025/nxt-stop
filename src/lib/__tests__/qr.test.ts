import { describe, it, expect } from 'vitest'
import { generateTicketNumber, generateOrderNumber } from '../qr'

describe('generateTicketNumber', () => {
  it('returns a string starting with NXT-', () => {
    const num = generateTicketNumber()
    expect(num).toMatch(/^NXT-[A-Z0-9]+-[A-F0-9]{8}$/)
  })

  it('generates unique values across 1000 calls', () => {
    const set = new Set(Array.from({ length: 1000 }, () => generateTicketNumber()))
    expect(set.size).toBe(1000)
  })
})

describe('generateOrderNumber', () => {
  it('returns a string starting with ORD-', () => {
    const num = generateOrderNumber()
    expect(num).toMatch(/^ORD-[A-Z0-9]+-[A-F0-9]{8}$/)
  })

  it('generates unique values across 1000 calls', () => {
    const set = new Set(Array.from({ length: 1000 }, () => generateOrderNumber()))
    expect(set.size).toBe(1000)
  })
})
