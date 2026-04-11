import { describe, it, expect } from 'vitest'
import { createHash } from 'crypto'

describe('Paynow webhook hash verification', () => {
  const integrationKey = 'test-integration-key-123'

  function computePaynowHash(params: Record<string, string>): string {
    const hashInput = [
      params.status ?? '',
      params.reference ?? '',
      params.amount ?? '',
      params.paynowreference ?? '',
      params.pollurl ?? '',
    ].join('') + integrationKey.toLowerCase()
    return createHash('sha512').update(hashInput).digest('hex').toUpperCase()
  }

  it('produces a valid SHA-512 hex string (128 chars)', () => {
    const hash = computePaynowHash({
      status: 'Paid',
      reference: 'ORD-TEST-001',
      amount: '10.00',
      paynowreference: 'PAY123',
      pollurl: 'https://www.paynow.co.zw/poll/123',
    })
    expect(hash).toHaveLength(128)
    expect(hash).toMatch(/^[A-F0-9]{128}$/)
  })

  it('is deterministic for the same input', () => {
    const params = {
      status: 'Paid',
      reference: 'ORD-TEST-002',
      amount: '25.00',
      paynowreference: 'PAY456',
      pollurl: 'https://www.paynow.co.zw/poll/456',
    }
    expect(computePaynowHash(params)).toBe(computePaynowHash(params))
  })

  it('changes when status differs', () => {
    const base = {
      reference: 'ORD-TEST-003',
      amount: '15.00',
      paynowreference: 'PAY789',
      pollurl: 'https://www.paynow.co.zw/poll/789',
    }
    const paid = computePaynowHash({ ...base, status: 'Paid' })
    const failed = computePaynowHash({ ...base, status: 'Failed' })
    expect(paid).not.toBe(failed)
  })

  it('is sensitive to integration key', () => {
    const params = {
      status: 'Paid',
      reference: 'ORD-TEST-004',
      amount: '10.00',
      paynowreference: 'PAY000',
      pollurl: 'https://www.paynow.co.zw/poll/000',
    }
    const hash1 = computePaynowHash(params)

    const otherKey = 'different-key'
    const hashInput = [
      params.status, params.reference, params.amount,
      params.paynowreference, params.pollurl,
    ].join('') + otherKey.toLowerCase()
    const hash2 = createHash('sha512').update(hashInput).digest('hex').toUpperCase()

    expect(hash1).not.toBe(hash2)
  })
})
