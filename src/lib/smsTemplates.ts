import { appUrl } from './utils'

/**
 * SMS wording. Every message is kept to one 160-character GSM-7 segment: a single emoji or
 * curly quote switches the whole SMS to UCS-2 (70 chars a segment) and can triple the cost,
 * so all text goes through toGsm7() and long event names are cut to fit.
 */

export const SMS_LIMIT = 160

// GSM 03.38 basic set (1 char each) and extension set (2 chars each: escape + char)
const GSM7_BASIC = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
const GSM7_EXTENDED = '^{}\\[~]|€'

const REPLACEMENTS: Record<string, string> = {
  '‘': "'", '’': "'", '‚': "'", '′': "'",
  '“': '"', '”': '"', '„': '"', '″': '"',
  '–': '-', '—': '-', '−': '-', '…': '...', ' ': ' ', '•': '-',
}

/** Rewrites text into characters every phone can show without falling back to UCS-2. */
export function toGsm7(text: string): string {
  let out = ''
  for (const ch of text.normalize('NFC')) {
    const mapped = REPLACEMENTS[ch] ?? ch
    for (const c of mapped) {
      if (GSM7_BASIC.includes(c) || GSM7_EXTENDED.includes(c)) out += c
      else {
        // Drop accents we can't send (é is in the set, ê isn't); drop emoji and the rest
        const plain = c.normalize('NFD').replace(/[̀-ͯ]/g, '')
        if (plain.length === 1 && GSM7_BASIC.includes(plain)) out += plain
      }
    }
  }
  return out.replace(/ {2,}/g, ' ').trim()
}

/** Billable length: extension-set characters take two slots. */
export function gsm7Length(text: string): number {
  let n = 0
  for (const c of text) n += GSM7_EXTENDED.includes(c) ? 2 : 1
  return n
}

/** Credits a message costs: one up to 160 characters, then 153 per part (6 go to the joining header). */
export function smsSegments(text: string): number {
  const n = gsm7Length(text)
  return n <= SMS_LIMIT ? 1 : Math.ceil(n / 153)
}

/** "nxt-stop.com" — links phones still make tappable, without https://www. eating characters. */
export function smsHost(): string {
  return appUrl().replace(/^https?:\/\//, '').replace(/^www\./, '')
}

function clip(text: string, max: number): string {
  if (gsm7Length(text) <= max) return text
  return `${text.slice(0, Math.max(1, max - 3)).trimEnd()}...`
}

/**
 * Builds the message to fit one segment, giving up the least useful part first: the whole
 * `name` with the tail (e.g. the order number), then the whole name without the tail, and
 * only then a shortened name.
 */
function fit(build: (name: string, tail: string) => string, name: string, tail: string): string {
  const cleanName = toGsm7(name)
  const make = (n: string, t: string) => toGsm7(build(n, t))
  const full = make(cleanName, tail)
  if (gsm7Length(full) <= SMS_LIMIT) return full
  const noTail = make(cleanName, '')
  if (gsm7Length(noTail) <= SMS_LIMIT) return noTail
  // Measured with a one-letter name so collapsing spaces can't skew the count
  const room = SMS_LIMIT - (gsm7Length(make('X', '')) - 1)
  return clip(make(clip(cleanName, Math.max(room, 4)), ''), SMS_LIMIT)
}

const money = (amount: number) => `$${amount.toFixed(2)}`

export function ticketsPaidSms(o: { amount: number; qty: number; eventName: string; eventDate: string; orderNumber: string }): string {
  const tickets = o.qty === 1 ? 'ticket' : 'tickets'
  const verb = o.qty === 1 ? 'is' : 'are'
  return fit(
    (event, tail) => `NXT STOP: Payment of ${money(o.amount)} received. Your ${o.qty} ${tickets} for ${event} on ${o.eventDate} ${verb} ready. View: ${smsHost()}/dashboard/tickets${tail}`,
    o.eventName,
    ` Order ${o.orderNumber}`,
  )
}

export function vouchersPaidSms(o: { amount: number; items: string; orderNumber: string }): string {
  return fit(
    (items, tail) => `NXT STOP: Payment of ${money(o.amount)} received for ${items}. Show your voucher code(s) at the bar/stand: ${smsHost()}/dashboard/purchases${tail}`,
    o.items,
    ` Order ${o.orderNumber}`,
  )
}

const METHOD_LABEL: Record<string, string> = {
  ecocash: 'EcoCash', onemoney: 'OneMoney', innbucks: 'InnBucks', omari: "O'mari", vmc: 'card', standard: 'payment method',
}

/** `what` is the event name, or the item list for an order without tickets. */
export function paymentPendingSms(o: { amount: number; method: string; what: string; hasTickets: boolean }): string {
  const after = o.hasTickets ? 'Your tickets will be sent' : 'Your order will be confirmed'
  return fit(
    what => `NXT STOP: Check your phone and enter your ${METHOD_LABEL[o.method] ?? o.method} PIN to approve ${money(o.amount)} for ${what}. ${after} as soon as payment is confirmed.`,
    o.what,
    '',
  )
}

/** Sends them back to the event to try again, or to the events list for an order without one. */
export function paymentFailedSms(o: { amount: number; what: string; slug: string | null }): string {
  const link = `${smsHost()}/events${o.slug ? `/${o.slug}` : ''}`
  return fit(
    what => `NXT STOP: Your payment of ${money(o.amount)} for ${what} did not go through and you were not charged. Try again: ${link}`,
    o.what,
    '',
  )
}

// Account messages carry a password or link that can't be shortened. Welcome fits one
// segment; line-up (once per person, event name kept whole) and the reset link take two.

export function welcomeSms(o: { phone: string; password: string }): string {
  return toGsm7(`Welcome to NXT STOP! Log in at ${smsHost()}/login with ${o.phone} and one-time password ${o.password}. You will choose your own password after logging in.`)
}

export function lineupSms(o: { eventName: string; phone: string; password: string }): string {
  return toGsm7(`NXT STOP: You are on the line-up for ${o.eventName}! Log in at ${smsHost()}/login with ${o.phone} and one-time password ${o.password} to see your sales and earnings.`)
}

export function passwordResetSms(o: { token: string; minutes: number }): string {
  return toGsm7(`NXT STOP: Reset your password here: ${smsHost()}/reset-password?token=${o.token} This link expires in ${o.minutes} minutes. Did not ask for this? Ignore this message.`)
}

export function referralRewardSms(o: { amount: number; total: number }): string {
  return toGsm7(`NXT STOP: You earned ${money(o.amount)}! Someone bought tickets through your link. Total earnings: ${money(o.total)}. Track it: ${smsHost()}/dashboard`)
}

// Replies can't reach an alphanumeric sender ID, so messages point to a page instead of
// "reply to this message".

export function passwordChangedSms(): string {
  return `NXT STOP: Your password was just changed. If this was not you, reset it now at ${smsHost()}/forgot-password to secure your account.`
}

/** Paid, but the tickets couldn't be issued yet — sent once while the retry happens. */
export function ticketsDelayedSms(o: { amount: number; orderNumber: string }): string {
  return toGsm7(`NXT STOP: We received ${money(o.amount)} for order ${o.orderNumber}. Your tickets are being prepared and will arrive shortly. No need to pay again.`)
}

export function refundSms(o: { amount: number; orderNumber: string; method: string }): string {
  return toGsm7(`NXT STOP: A refund of ${money(o.amount)} for order ${o.orderNumber} has been processed to your ${METHOD_LABEL[o.method] ?? o.method}. It may take up to 3 working days to reflect.`)
}

export function eventTomorrowSms(o: { eventName: string; time: string; venue: string }): string {
  return fit(
    event => `NXT STOP: See you tomorrow at ${event}! Gates open ${o.time} at ${toGsm7(o.venue)}. Have your ticket QR ready: ${smsHost()}/dashboard/tickets`,
    o.eventName,
    '',
  )
}

export function eventTodaySms(o: { eventName: string; time: string; venue: string }): string {
  return fit(
    event => `NXT STOP: Today is the day! ${event} - gates open ${o.time}, ${toGsm7(o.venue)}. Screenshot your ticket QR before you arrive in case signal is weak.`,
    o.eventName,
    '',
  )
}

export function loginCodeSms(o: { code: string; minutes: number }): string {
  return `${o.code} is your NXT STOP verification code. It expires in ${o.minutes} minutes. Never share this code with anyone, including NXT STOP staff.`
}

export function phoneChangeCodeSms(o: { code: string; minutes: number }): string {
  return `NXT STOP: Your code to change your phone number is ${o.code}. Valid for ${o.minutes} minutes. If you did not request this, ignore this message and your account stays safe.`
}

export function ticketTransferSms(o: { sender: string; eventName: string; eventDate: string }): string {
  return fit(
    event => `NXT STOP: ${toGsm7(o.sender).slice(0, 30)} sent you a ticket for ${event} on ${o.eventDate}. Log in with this number to view it: ${smsHost()}/login`,
    o.eventName,
    '',
  )
}
