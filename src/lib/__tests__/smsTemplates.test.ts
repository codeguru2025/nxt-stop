import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  toGsm7, gsm7Length, smsHost, smsSegments, ticketsPaidSms, vouchersPaidSms, paymentPendingSms, paymentFailedSms,
  welcomeSms, lineupSms, passwordResetSms, referralRewardSms, passwordChangedSms, ticketsDelayedSms, refundSms,
  eventTomorrowSms, eventTodaySms, loginCodeSms, phoneChangeCodeSms, ticketTransferSms, PROMO_TEMPLATES, SMS_LIMIT,
} from '../smsTemplates'

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

describe('payment pending and failed', () => {
  const longName = 'Dlala Thukzin Live at the Harare International Conference Centre 2026 🔥🔥'

  it('names the wallet and says what happens next', () => {
    expect(paymentPendingSms({ amount: 20, method: 'ecocash', what: 'Dlala Thukzin', hasTickets: true })).toBe(
      'NXT STOP: Check your phone and enter your EcoCash PIN to approve $20.00 for Dlala Thukzin. Your tickets will be sent as soon as payment is confirmed.',
    )
    expect(paymentPendingSms({ amount: 20, method: 'onemoney', what: '2x Beer', hasTickets: false }))
      .toContain('OneMoney PIN to approve $20.00 for 2x Beer. Your order will be confirmed')
  })

  it('links back to the event, or to all events without one', () => {
    expect(paymentFailedSms({ amount: 20, what: 'Dlala Thukzin', slug: 'dlala-thukzin' })).toBe(
      'NXT STOP: Your payment of $20.00 for Dlala Thukzin did not go through and you were not charged. Try again: nxt-stop.com/events/dlala-thukzin',
    )
    expect(paymentFailedSms({ amount: 20, what: '1x Cap', slug: null })).toMatch(/Try again: nxt-stop\.com\/events$/)
  })

  it('fits one segment with a long event name', () => {
    for (const sms of [
      paymentPendingSms({ amount: 1234.5, method: 'onemoney', what: longName, hasTickets: true }),
      paymentFailedSms({ amount: 1234.5, what: longName, slug: 'dlala-thukzin-live-hicc-2026' }),
    ]) {
      expect(gsm7Length(sms)).toBeLessThanOrEqual(SMS_LIMIT)
      expect(sms).toMatch(GSM7_ONLY)
    }
  })
})

describe('account messages', () => {
  it('welcome carries the login details in one segment', () => {
    const sms = welcomeSms({ phone: '+263771234567', password: 'AB3DEF7HJK' })
    expect(sms).toBe('Welcome to NXT STOP! Log in at nxt-stop.com/login with +263771234567 and one-time password AB3DEF7HJK. You will choose your own password after logging in.')
    expect(smsSegments(sms)).toBe(1)
  })

  it('line-up keeps the whole event name', () => {
    const sms = lineupSms({ eventName: 'Dlala Thukzin Live', phone: '+263771234567', password: 'AB3DEF7HJK' })
    expect(sms).toBe('NXT STOP: You are on the line-up for Dlala Thukzin Live! Log in at nxt-stop.com/login with +263771234567 and one-time password AB3DEF7HJK to see your sales and earnings.')
    expect(smsSegments(sms)).toBe(2)
  })

  it('password reset has the full link and the real expiry', () => {
    const token = 'a'.repeat(64)
    const sms = passwordResetSms({ token, minutes: 30 })
    expect(sms).toContain(`nxt-stop.com/reset-password?token=${token} This link expires in 30 minutes.`)
    expect(smsSegments(sms)).toBe(2)
  })

  it('referral reward shows this reward and the running total', () => {
    expect(referralRewardSms({ amount: 2.5, total: 17 })).toBe(
      'NXT STOP: You earned $2.50! Someone bought tickets through your link. Total earnings: $17.00. Track it: nxt-stop.com/dashboard',
    )
  })
})

describe('order follow-ups and reminders', () => {
  it('points to a page instead of asking for a reply', () => {
    expect(passwordChangedSms()).toBe('NXT STOP: Your password was just changed. If this was not you, reset it now at nxt-stop.com/forgot-password to secure your account.')
    expect(ticketsDelayedSms({ amount: 20, orderNumber: 'ORD-1' })).toBe(
      'NXT STOP: We received $20.00 for order ORD-1. Your tickets are being prepared and will arrive shortly. No need to pay again.',
    )
  })

  it('names the wallet the refund went to', () => {
    expect(refundSms({ amount: 20, orderNumber: 'ORD-MFX1ABCD-1A2B3C4D', method: 'ecocash' })).toBe(
      'NXT STOP: A refund of $20.00 for order ORD-MFX1ABCD-1A2B3C4D has been processed to your EcoCash. It may take up to 3 working days to reflect.',
    )
  })

  it('reminders fit one segment with long names and venues', () => {
    const o = { eventName: 'Dlala Thukzin Live at the Harare International Conference Centre 2026', time: '20:00', venue: 'Harare International Conference Centre' }
    for (const sms of [eventTomorrowSms(o), eventTodaySms(o)]) {
      expect(gsm7Length(sms)).toBeLessThanOrEqual(SMS_LIMIT)
      expect(sms).toMatch(GSM7_ONLY)
    }
    expect(eventTomorrowSms({ eventName: 'Dlala', time: '20:00', venue: 'HICC' })).toBe(
      'NXT STOP: See you tomorrow at Dlala! Gates open 20:00 at HICC. Have your ticket QR ready: nxt-stop.com/dashboard/tickets',
    )
  })
})

describe('code messages', () => {
  it('put the code first for the login code and fit one segment', () => {
    const login = loginCodeSms({ code: '482913', minutes: 10 })
    expect(login).toBe('482913 is your NXT STOP verification code. It expires in 10 minutes. Never share this code with anyone, including NXT STOP staff.')
    expect(smsSegments(login)).toBe(1)
    expect(smsSegments(phoneChangeCodeSms({ code: '482913', minutes: 10 }))).toBe(1)
  })
})

describe('ticketTransferSms', () => {
  it('says who sent it and where to log in', () => {
    expect(ticketTransferSms({ sender: 'Tendai Moyo', eventName: 'Dlala Thukzin', eventDate: 'Sat 4 Oct' })).toBe(
      'NXT STOP: Tendai Moyo sent you a ticket for Dlala Thukzin on Sat 4 Oct. Log in with this number to view it: nxt-stop.com/login',
    )
  })

  it('fits one segment with long names', () => {
    const sms = ticketTransferSms({ sender: 'Tendai Rutendo Chipo Nyasha Moyo-Mutasa', eventName: 'Dlala Thukzin Live at the Harare International Conference Centre 2026', eventDate: 'Sat 4 Oct' })
    expect(gsm7Length(sms)).toBeLessThanOrEqual(SMS_LIMIT)
  })
})

describe('promotional templates', () => {
  const fields = {
    eventName: 'Dlala Thukzin', slug: 'dlala-thukzin', date: 'Sat 4 Oct', venue: 'HICC', price: 20,
    deadline: 'Friday', ticketType: 'VIP', referralCode: 'cmto9l5rv00020uqzituhchx9', referralPercent: 10,
  }

  it('every one ends with the opt-out link and stays GSM-7', () => {
    for (const build of Object.values(PROMO_TEMPLATES)) {
      const sms = build(fields)
      expect(sms).toMatch(/ Opt out: nxt-stop\.com\/stop$/)
      expect(sms).toMatch(GSM7_ONLY)
    }
  })

  it('reads like the agreed copy', () => {
    expect(PROMO_TEMPLATES['new-event'](fields)).toBe(
      'NXT STOP: Dlala Thukzin is coming Sat 4 Oct at HICC! Tickets from $20.00. Get yours: nxt-stop.com/events/dlala-thukzin Opt out: nxt-stop.com/stop',
    )
    expect(PROMO_TEMPLATES['win-back'](fields)).toBe(
      'NXT STOP: We miss you! Check out what is on this month and get your tickets early: nxt-stop.com/events Opt out: nxt-stop.com/stop',
    )
  })

  it('shortens a long event name to stay in one segment', () => {
    const sms = PROMO_TEMPLATES['new-event']({ ...fields, eventName: 'Dlala Thukzin Live at the Harare International Conference Centre 2026' })
    expect(smsSegments(sms)).toBe(1)
    expect(sms).toContain('nxt-stop.com/events/dlala-thukzin Opt out')
  })

  it('goes to two segments rather than cut a name below 12 characters', () => {
    const sms = PROMO_TEMPLATES['last-chance']({ ...fields, eventName: 'Dlala Thukzin Live at the Harare International Conference Centre 2026' })
    expect(sms).toContain('Dlala Thukzin Live at the Harare International Conference Centre 2026 is tomorrow')
    expect(smsSegments(sms)).toBe(2)
  })

  it('never cuts the link or opt-out: the share link goes to two segments instead', () => {
    const sms = PROMO_TEMPLATES['share-link']({ ...fields, eventName: 'Dlala Thukzin Live at the HICC' })
    expect(sms).toContain(`nxt-stop.com/r/${fields.referralCode}?e=dlala-thukzin Opt out: nxt-stop.com/stop`)
    expect(smsSegments(sms)).toBe(2)
  })
})
