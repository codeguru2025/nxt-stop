import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { toGsm7, gsm7Length, smsHost, ticketsPaidSms, vouchersPaidSms, SMS_LIMIT } from '../smsTemplates'

// Anything outside GSM-7 turns the SMS into UCS-2 (70 chars a segment)
const GSM7_ONLY = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà^{}\\[~\]|€]*$/

beforeEach(() => vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://www.nxt-stop.com'))
afterEach(() => vi.unstubAllEnvs())

describe('toGsm7', () => {
  it('swaps curly quotes and long dashes for plain ones', () => {
    expect(toGsm7('“Dlala’s” — live…')).toBe('"Dlala\'s" - live...')
  })

  it('drops emoji and unsupported accents but keeps the letters', () => {
    expect(toGsm7('Amapiano 🔥🔥 Fête')).toBe('Amapiano Fete')
  })

  it('counts extension characters as two', () => {
    expect(gsm7Length('a€[')).toBe(5)
  })
})

describe('smsHost', () => {
  it('strips the scheme and www', () => {
    expect(smsHost()).toBe('nxt-stop.com')
  })
})

describe('ticketsPaidSms', () => {
  const base = { amount: 25, qty: 2, eventDate: 'Sat 4 Oct', orderNumber: 'ORD-MFX1ABCD-1A2B3C4D' }

  it('reads naturally for a normal order', () => {
    expect(ticketsPaidSms({ ...base, eventName: 'Dlala Thukzin' })).toBe(
      'NXT STOP: Payment of $25.00 received. Your 2 tickets for Dlala Thukzin on Sat 4 Oct are ready. View: nxt-stop.com/dashboard/tickets Order ORD-MFX1ABCD-1A2B3C4D',
    )
  })

  it('uses the singular for one ticket', () => {
    expect(ticketsPaidSms({ ...base, qty: 1, eventName: 'X' })).toContain('Your 1 ticket for X on Sat 4 Oct is ready')
  })

  it('always fits one GSM-7 segment, whatever the event is called', () => {
    for (const eventName of ['A', 'Dlala Thukzin Live at the Harare International Conference Centre 2026 🔥🔥', '“Summer’s” — Jam'.repeat(8)]) {
      const sms = ticketsPaidSms({ ...base, amount: 12345.5, qty: 10, eventName })
      expect(gsm7Length(sms)).toBeLessThanOrEqual(SMS_LIMIT)
      expect(sms).toMatch(GSM7_ONLY)
      expect(sms).toContain('nxt-stop.com/dashboard/tickets')
    }
  })
})

describe('vouchersPaidSms', () => {
  it('lists the items and fits one segment', () => {
    const sms = vouchersPaidSms({ amount: 40, items: '2x Hennessy VS, 1x VIP Table', orderNumber: 'ORD-MFX1ABCD-1A2B3C4D' })
    expect(sms).toContain('for 2x Hennessy VS, 1x VIP Table.')
    expect(gsm7Length(sms)).toBeLessThanOrEqual(SMS_LIMIT)
  })

  it('shortens a long item list instead of going over', () => {
    const sms = vouchersPaidSms({ amount: 40, items: Array(20).fill('3x Premium Bottle Service').join(', '), orderNumber: 'ORD-MFX1ABCD-1A2B3C4D' })
    expect(gsm7Length(sms)).toBeLessThanOrEqual(SMS_LIMIT)
    expect(sms).toContain('nxt-stop.com/dashboard/purchases')
  })
})
