import { prisma } from './db'
import { env } from './env'
import { normalizeWhatsAppPhone } from './phone'
import { formatDate } from './utils'
import {
  eventTodaySms, eventTomorrowSms, lineupSms, passwordChangedSms, passwordResetSms, paymentFailedSms,
  paymentPendingSms, referralRewardSms, refundSms, smsSegments, ticketsDelayedSms,
  ticketsPaidSms, vouchersPaidSms, welcomeSms,
} from './smsTemplates'
import { checkSmsCreditAlert, maskPhone, smsCredits } from './smsCredits'

/** Gateways route and bill these differently; promotional ones must carry an opt-out. */
export type SmsKind = 'transactional' | 'otp' | 'promotional'

/** Sends one SMS to an E.164 number (+2637...). Throws on a provider error. */
type SmsProvider = (to: string, text: string, kind: SmsKind, reference?: string) => Promise<void>

const SEND_TIMEOUT_MS = 15_000

// SMSala HTTP API — https://smsala.com/wp-content/uploads/api-integration-documentation-for-smsala.pdf
const SMSALA_TYPE: Record<SmsKind, string> = { promotional: '1', transactional: '2', otp: '3' }

async function smsala(to: string, text: string, kind: SmsKind, reference?: string): Promise<void> {
  const apiToken = env.SMSALA_API_TOKEN
  const sender = env.SMSALA_SENDER_ID
  if (!apiToken || !sender) throw new Error('SMSALA_API_TOKEN and SMSALA_SENDER_ID must be set')

  const res = await fetch('https://api2.smsala.com/SendSmsV2', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    // SMSala takes an array of messages, even for one
    body: JSON.stringify([{
      apiToken,
      messageType: SMSALA_TYPE[kind],
      messageEncoding: '0', // GSM default alphabet — smsTemplates keeps text within it
      destinationAddress: to.replace(/^\+/, ''), // country code, no plus
      sourceAddress: sender,
      messageText: text,
      ...(reference ? { userReferenceId: reference } : {}),
    }]),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  })
  const raw = await res.text()
  let result: { OperationCode?: number; Status?: string; Remarks?: string } | undefined
  try {
    const data = JSON.parse(raw)
    result = Array.isArray(data) ? data[0] : data
  } catch { /* not JSON — reported below */ }
  if (!res.ok || result?.Status !== 'Success' || (result.OperationCode ?? 0) !== 0) {
    throw new Error(`SMSala rejected the SMS (HTTP ${res.status}): ${result?.Remarks ?? raw.slice(0, 200)}`)
  }
}

// SMS_PROVIDER picks the gateway
const PROVIDERS: Record<string, SmsProvider> = {
  smsala,
  // Local testing: prints instead of sending
  log: async (to, text, kind) => { console.log(`[sms] ${kind} to ${to} (${text.length} chars): ${text}`) },
}

function provider(): SmsProvider | null {
  const name = env.SMS_PROVIDER
  if (!name) return null // SMS not configured — degrade silently, like WhatsApp and email
  const p = PROVIDERS[name]
  if (!p) console.warn(`[sms] unknown SMS_PROVIDER "${name}" — SMS disabled`)
  return p ?? null
}

/**
 * off: SMS not configured · invalid: bad phone number · no_credit: credits used up ·
 * failed: the gateway (or the credit ledger) refused · sent: accepted by the gateway
 */
export type SmsResult = 'off' | 'invalid' | 'no_credit' | 'failed' | 'sent'

/**
 * Sends one SMS if there are credits for it, and logs every attempt in SmsMessage (the
 * ledger behind credits used and the daily report). Never throws — callers always send
 * email/WhatsApp as well, so a missing SMS is never the only way a customer hears from us.
 */
export async function sendSms(
  rawPhone: string,
  text: string,
  opts: { kind: SmsKind; purpose: string; reference?: string },
): Promise<SmsResult> {
  const send = provider()
  if (!send) return 'off'
  const to = normalizeWhatsAppPhone(rawPhone)
  if (!to) {
    console.warn(`[sms] not a valid phone number: ${rawPhone}`)
    return 'invalid'
  }

  let remaining: number
  try {
    remaining = (await smsCredits()).remaining
  } catch (err) {
    // Without the ledger we can't count credits — don't send blind
    console.error('[sms] credit ledger unavailable (has the sms_credits migration run?) — SMS not sent', err)
    return 'failed'
  }

  const segments = smsSegments(text)
  const log = (status: Exclude<SmsResult, 'off' | 'invalid'>, error?: string) =>
    prisma.smsMessage.create({
      data: {
        kind: opts.kind, purpose: opts.purpose, phone: maskPhone(to), status, segments,
        reference: opts.reference ?? null, error: error?.slice(0, 500) ?? null,
      },
    }).catch(err => console.error('[sms] could not log message', err))

  if (remaining < segments) {
    await log('no_credit')
    await checkSmsCreditAlert(remaining)
    return 'no_credit'
  }

  try {
    await send(to, text, opts.kind, opts.reference)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[sms] ${opts.purpose} to ${maskPhone(to)} failed: ${message}`)
    await log('failed', message)
    return 'failed'
  }
  await log('sent')
  await checkSmsCreditAlert(remaining - segments)
  return 'sent'
}

// Payment confirmation, one SMS per paid order. It is extra, not instead: the ticket email
// and WhatsApp go out regardless, so when credits run out customers still get those.
// Sent once from fulfillOrder (only on first fulfilment), so it needs no sent-at column.
export async function sendOrderPaidSms(orderId: string): Promise<void> {
  if (!provider()) return

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      status: true, orderNumber: true, total: true, whatsappPhone: true, guestPhone: true,
      user: { select: { phone: true } },
      tickets: { select: { event: { select: { name: true, date: true } } } },
      vouchers: { select: { product: { select: { name: true } } } },
    },
  })
  if (!order || order.status !== 'paid') return

  const phone = order.whatsappPhone || order.guestPhone || order.user.phone
  const amount = Number(order.total)
  let text: string
  if (order.tickets.length > 0) {
    const { event } = order.tickets[0]
    text = ticketsPaidSms({
      amount,
      qty: order.tickets.length,
      eventName: event.name,
      eventDate: formatDate(event.date, 'EEE d MMM'),
      orderNumber: order.orderNumber,
    })
  } else if (order.vouchers.length > 0) {
    const counts = new Map<string, number>()
    for (const v of order.vouchers) counts.set(v.product.name, (counts.get(v.product.name) ?? 0) + 1)
    const items = [...counts].map(([name, n]) => `${n}x ${name}`).join(', ')
    text = vouchersPaidSms({ amount, items, orderNumber: order.orderNumber })
  } else {
    return
  }

  await sendSms(phone, text, { kind: 'transactional', purpose: 'order.paid', reference: order.orderNumber })
}

/** What an unpaid order is for: its event (from a ticket, else a product), or its item names. */
async function unpaidOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      orderNumber: true, total: true, status: true, whatsappPhone: true, guestPhone: true,
      user: { select: { phone: true } },
      items: {
        select: {
          name: true, quantity: true,
          ticketType: { select: { event: { select: { name: true, slug: true } } } },
          product: { select: { event: { select: { name: true, slug: true } } } },
        },
      },
    },
  })
  if (!order) return null
  const ticketEvent = order.items.find(i => i.ticketType)?.ticketType?.event
  const event = ticketEvent ?? order.items.find(i => i.product?.event)?.product?.event ?? null
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    amount: Number(order.total),
    phone: order.whatsappPhone || order.guestPhone || order.user.phone,
    hasTickets: !!ticketEvent,
    what: event?.name ?? order.items.map(i => `${i.quantity}x ${i.name}`).join(', '),
    slug: event?.slug ?? null,
  }
}

// Mobile money only: the PIN prompt arrives on the phone that pays, so that's where this goes.
export async function sendPaymentPendingSms(orderId: string, method: string, payerPhone: string): Promise<void> {
  if (!provider() || !['ecocash', 'onemoney'].includes(method)) return
  const order = await unpaidOrder(orderId)
  if (!order) return
  const text = paymentPendingSms({ amount: order.amount, method, what: order.what, hasTickets: order.hasTickets })
  await sendSms(payerPhone, text, { kind: 'transactional', purpose: 'order.pending', reference: order.orderNumber })
}

// Called by whichever of the Paynow webhook or poll flips the order to failed, so it goes once.
export async function sendPaymentFailedSms(orderId: string): Promise<void> {
  if (!provider()) return
  const order = await unpaidOrder(orderId)
  if (!order) return
  const text = paymentFailedSms({ amount: order.amount, what: order.what, slug: order.slug })
  await sendSms(order.phone, text, { kind: 'transactional', purpose: 'order.failed', reference: order.orderNumber })
}

// New account with a system-issued one-time password (checkout or gate sale). The SMS
// reaches buyers who gave no email, who otherwise never see the password.
export async function sendWelcomeSms(userId: string, password: string): Promise<void> {
  if (!provider()) return
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } })
  if (!user) return
  await sendSms(user.phone, welcomeSms({ phone: user.phone, password }), { kind: 'transactional', purpose: 'account.welcome' })
}

// Line-up member given a one-time password, when added or when an admin issues a new one
export async function sendLineupSms(userId: string, eventName: string, password: string): Promise<void> {
  if (!provider()) return
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } })
  if (!user) return
  await sendSms(user.phone, lineupSms({ eventName, phone: user.phone, password }), { kind: 'transactional', purpose: 'lineup.login' })
}

export async function sendPasswordResetSms(userId: string, token: string, minutes: number): Promise<void> {
  if (!provider()) return
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } })
  if (!user) return
  await sendSms(user.phone, passwordResetSms({ token, minutes }), { kind: 'transactional', purpose: 'auth.password-reset' })
}

export async function sendReferralRewardSms(userId: string, amount: number): Promise<void> {
  if (!provider()) return
  const [user, total] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { phone: true } }),
    prisma.referralReward.aggregate({ where: { userId, status: { not: 'cancelled' } }, _sum: { amount: true } }),
  ])
  if (!user) return
  const text = referralRewardSms({ amount, total: Number(total._sum.amount ?? amount) })
  await sendSms(user.phone, text, { kind: 'transactional', purpose: 'referral.reward' })
}

/** The SMS ledger doubles as a sent-once guard for messages that have no sent-at column. */
async function alreadyLogged(purpose: string, reference: string): Promise<boolean> {
  return !!(await prisma.smsMessage.findFirst({ where: { purpose, reference }, select: { id: true } }))
}

export async function sendPasswordChangedSms(userId: string): Promise<void> {
  if (!provider()) return
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } })
  if (!user) return
  await sendSms(user.phone, passwordChangedSms(), { kind: 'transactional', purpose: 'auth.password-changed' })
}

// Payment confirmed but fulfilOrder failed and will be retried (webhook redelivery, next
// poll, or an admin). Once per order, however many times the retry fails.
export async function sendTicketsDelayedSms(orderId: string): Promise<void> {
  if (!provider()) return
  const order = await unpaidOrder(orderId)
  // A webhook and a poll can race: the one that loses may fail after the other fulfilled it
  if (!order || order.status === 'paid' || await alreadyLogged('order.delayed', order.orderNumber)) return
  const text = ticketsDelayedSms({ amount: order.amount, orderNumber: order.orderNumber })
  await sendSms(order.phone, text, { kind: 'transactional', purpose: 'order.delayed', reference: order.orderNumber })
}

export async function sendRefundSms(orderId: string): Promise<void> {
  if (!provider()) return
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { orderNumber: true, total: true, paymentMethod: true, whatsappPhone: true, guestPhone: true, user: { select: { phone: true } } },
  })
  if (!order) return
  const text = refundSms({ amount: Number(order.total), orderNumber: order.orderNumber, method: order.paymentMethod ?? 'standard' })
  const phone = order.whatsappPhone || order.guestPhone || order.user.phone
  await sendSms(phone, text, { kind: 'transactional', purpose: 'order.refunded', reference: order.orderNumber })
}

export type ReminderKind = 'tomorrow' | 'today'
const REMINDER_HOUR: Record<ReminderKind, number> = { tomorrow: 12, today: 9 } // venue time

/**
 * Which reminder, if any, is due for an event right now: "tomorrow" from noon the day
 * before, "today" from 9am on the day until it starts. Days and hours are venue time.
 */
export function reminderDue(eventDate: Date, now: Date): ReminderKind | null {
  if (eventDate <= now) return null
  const day = (d: Date) => formatDate(d, 'yyyy-MM-dd')
  const hour = Number(formatDate(now, 'H'))
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  if (day(eventDate) === day(now)) return hour >= REMINDER_HOUR.today ? 'today' : null
  if (day(eventDate) === day(tomorrow)) return hour >= REMINDER_HOUR.tomorrow ? 'tomorrow' : null
  return null
}

/**
 * Reminds every ticket holder of events happening tomorrow or today. Run hourly: each
 * holder gets each reminder once (the ledger remembers), and a later run picks up anyone
 * who bought since. Returns how many SMS were attempted.
 */
export async function sendEventReminders(now = new Date()): Promise<number> {
  if (!provider()) return 0
  const events = await prisma.event.findMany({
    where: { status: { in: ['published', 'live'] }, date: { gt: now, lt: new Date(now.getTime() + 48 * 60 * 60 * 1000) } },
    select: { id: true, name: true, venue: true, date: true },
  })
  let attempted = 0
  for (const event of events) {
    const kind = reminderDue(event.date, now)
    if (!kind) continue
    const purpose = `event.reminder-${kind}`
    const holders = await prisma.ticket.findMany({
      where: { eventId: event.id, status: 'valid' },
      distinct: ['userId'],
      select: { userId: true, user: { select: { phone: true } } },
    })
    const done = new Set((await prisma.smsMessage.findMany({
      where: { purpose, reference: { startsWith: `${event.id}:` } },
      select: { reference: true },
    })).map(m => m.reference))
    const args = { eventName: event.name, time: formatDate(event.date, 'HH:mm'), venue: event.venue }
    const text = kind === 'tomorrow' ? eventTomorrowSms(args) : eventTodaySms(args)
    for (const h of holders) {
      const reference = `${event.id}:${h.userId}`
      if (done.has(reference)) continue
      const result = await sendSms(h.user.phone, text, { kind: 'transactional', purpose, reference })
      attempted++
      if (result === 'no_credit') return attempted // the rest would be refused too
    }
  }
  return attempted
}
