import { prisma } from './db'
import { env } from './env'
import { normalizeWhatsAppPhone } from './phone'
import { eventEndTime, formatDate } from './utils'
import {
  eventTodaySms, eventTomorrowSms, lineupSms, loginCodeSms, passwordChangedSms, passwordResetSms,
  paymentFailedSms, paymentPendingSms, phoneChangeCodeSms, referralRewardSms, refundSms, smsSegments,
  ticketsDelayedSms, ticketsPaidSms, ticketTransferSms, vouchersPaidSms, welcomeSms,
} from './smsTemplates'
import { checkSmsCreditAlert, maskPhone, smsCredits } from './smsCredits'
import { CODE_TTL_MINUTES } from './smsCodes'
import { isSmsSwitchedOff } from './smsSettings'
import { emailEnabled, sendTextEmail } from './email'

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
 * off: SMS not configured, or this message switched off on /admin/sms · invalid: bad phone
 * number · no_credit: credits used up · failed: the gateway (or the credit ledger) refused ·
 * sent: accepted by the gateway
 */
export type SmsResult = 'off' | 'invalid' | 'no_credit' | 'failed' | 'sent'

type SmsOpts = { kind: SmsKind; purpose: string; reference?: string }

/**
 * Credits only sign-in and phone-change codes may use, so a busy sales day spending the
 * last credits on payment SMS can't lock anyone out of their account.
 */
export const OTP_RESERVE = 20
const creditFloor = (kind: SmsKind) => (kind === 'otp' ? 0 : OTP_RESERVE)
type Attempt = { result: SmsResult; to: string | null; segments: number; error?: string }

/** Tries to send, without logging (the caller logs exactly one row per message). Never throws. */
async function attemptSms(rawPhone: string, text: string, opts: SmsOpts): Promise<Attempt> {
  const segments = smsSegments(text)
  const send = provider()
  // Promotional campaigns are sent by hand, so the automatic-SMS switches don't apply
  if (!send || (opts.kind !== 'promotional' && await isSmsSwitchedOff(opts.purpose))) {
    return { result: 'off', to: null, segments }
  }
  const to = normalizeWhatsAppPhone(rawPhone)
  if (!to) {
    console.warn(`[sms] not a valid phone number: ${rawPhone}`)
    return { result: 'invalid', to: null, segments }
  }

  let remaining: number
  try {
    remaining = (await smsCredits()).remaining
  } catch (err) {
    // Without the ledger we can't count credits — don't send blind (nothing to log to either)
    console.error('[sms] credit ledger unavailable (has the sms_credits migration run?) — SMS not sent', err)
    return { result: 'failed', to: null, segments }
  }

  if (remaining - creditFloor(opts.kind) < segments) {
    await checkSmsCreditAlert(remaining)
    return { result: 'no_credit', to, segments }
  }

  try {
    await send(to, text, opts.kind, opts.reference)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[sms] ${opts.purpose} to ${maskPhone(to)} failed: ${message}`)
    return { result: 'failed', to, segments, error: message }
  }
  await checkSmsCreditAlert(remaining - segments)
  return { result: 'sent', to, segments }
}

/**
 * One row in SmsMessage, the ledger behind credits used, the daily report and the sent-once
 * guards. `emailed` rows record an SMS that went by email instead, and cost no credits.
 */
async function logMessage(
  status: 'sent' | 'failed' | 'no_credit' | 'emailed',
  phone: string, segments: number, opts: SmsOpts, error?: string,
): Promise<void> {
  await prisma.smsMessage.create({
    data: {
      kind: opts.kind, purpose: opts.purpose, phone: maskPhone(phone), status,
      segments: status === 'emailed' ? 0 : segments,
      reference: opts.reference ?? null, error: error?.slice(0, 500) ?? null,
    },
  }).catch(err => console.error('[sms] could not log message', err))
}

/**
 * Sends one SMS if there are credits for it, and logs every attempt that reached the
 * gateway or the credit check. Never throws.
 */
export async function sendSms(rawPhone: string, text: string, opts: SmsOpts): Promise<SmsResult> {
  const a = await attemptSms(rawPhone, text, opts)
  if (a.to && (a.result === 'sent' || a.result === 'failed' || a.result === 'no_credit')) {
    await logMessage(a.result, a.to, a.segments, opts, a.error)
  }
  return a.result
}

/** How a message reached someone, or null when it couldn't. */
export type Delivery = 'sms' | 'email' | null

const WHY_NOT_SMS: Record<Exclude<SmsResult, 'sent'>, string> = {
  off: 'SMS switched off', invalid: 'not a valid phone number', no_credit: 'no SMS credits', failed: 'SMS failed',
}

/**
 * The general rule for messages that have no email of their own: SMS first, and when the
 * SMS can't go (switched off, no credits, gateway refused) the same text by email, so
 * nothing depends on SMS alone. Logs one row either way. Never throws.
 */
export async function smsOrEmail(
  rawPhone: string, email: string | null | undefined, text: string, opts: SmsOpts & { subject: string },
): Promise<Delivery> {
  const a = await attemptSms(rawPhone, text, opts)
  if (a.result === 'sent') {
    await logMessage('sent', a.to!, a.segments, opts)
    return 'sms'
  }
  const reason = a.error ? `${WHY_NOT_SMS[a.result]}: ${a.error}` : WHY_NOT_SMS[a.result]
  if (email && await sendTextEmail(email, opts.subject, text)) {
    await logMessage('emailed', a.to ?? rawPhone, a.segments, opts, reason)
    return 'email'
  }
  if (a.to && a.result !== 'off' && a.result !== 'invalid') await logMessage(a.result, a.to, a.segments, opts, a.error)
  return null
}

/**
 * Whether this message would go by SMS right now: SMS configured, the message switched on,
 * and credits left. Lets a screen say "check your SMS" or "check your email" up front.
 */
export async function smsAvailable(purpose: string, kind: SmsKind = 'transactional'): Promise<boolean> {
  if (!provider() || await isSmsSwitchedOff(purpose)) return false
  try {
    return (await smsCredits()).remaining > creditFloor(kind)
  } catch {
    return false
  }
}

// Payment confirmation, one SMS per paid order. It is extra, not instead: the ticket email
// and WhatsApp go out regardless, so when credits run out customers still get those.
// Sent once from fulfillOrder (only on first fulfilment), so it needs no sent-at column.
export async function sendOrderPaidSms(orderId: string): Promise<SmsResult | null> {
  if (!provider()) return 'off'

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      status: true, orderNumber: true, total: true, whatsappPhone: true, guestPhone: true,
      user: { select: { phone: true } },
      tickets: { select: { event: { select: { name: true, date: true } } } },
      vouchers: { select: { product: { select: { name: true } } } },
    },
  })
  if (!order || order.status !== 'paid') return null

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
    return null
  }

  return sendSms(phone, text, { kind: 'transactional', purpose: 'order.paid', reference: order.orderNumber })
}

// Left to fulfillOrder, which texts an order the moment it's paid — so the two never race
const CATCH_UP_AFTER_MS = 15 * 60 * 1000
let catchingUp = false

/**
 * Paid ticket orders whose payment confirmation never went out by SMS — bought before SMS
 * was set up, or while credits were out or the message was switched off — and whose event
 * hasn't ended. Oldest first.
 */
export async function ordersOwedPaymentSms(now = new Date()): Promise<string[]> {
  const [orders, done] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: 'paid',
        createdAt: { lt: new Date(now.getTime() - CATCH_UP_AFTER_MS) },
        // A day of slack for events with no end time set; eventEndTime decides below
        tickets: { some: { event: { date: { gt: new Date(now.getTime() - 2 * 24 * 3600e3) } } } },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, orderNumber: true, tickets: { take: 1, select: { event: { select: { date: true, endDate: true } } } } },
    }),
    // A refused send isn't retried: it's usually a bad number, and retrying hourly would log it forever
    prisma.smsMessage.findMany({ where: { purpose: 'order.paid', status: { in: ['sent', 'failed'] } }, select: { reference: true } }),
  ])
  const doneRefs = new Set(done.map(m => m.reference))
  return orders.filter(o => {
    const event = o.tickets[0]?.event
    return !doneRefs.has(o.orderNumber) && !!event && eventEndTime(event.date, event.endDate) > now
  }).map(o => o.id)
}

/**
 * Texts every order in ordersOwedPaymentSms; stops when credits run out, and the next run
 * carries on. Runs hourly and right after credits are added. Returns how many were sent.
 */
export async function sendMissedOrderPaidSms(now = new Date()): Promise<number> {
  if (catchingUp || !(await smsAvailable('order.paid'))) return 0
  catchingUp = true
  try {
    let sent = 0
    for (const id of await ordersOwedPaymentSms(now)) {
      const result = await sendOrderPaidSms(id)
      if (result === 'sent') sent++
      else if (result !== 'failed' && result !== 'invalid' && result !== null) break // off or out of credits: the rest would be too
    }
    return sent
  } finally {
    catchingUp = false
  }
}

/** Whether a message with an email fallback can reach anyone at all. */
function canNotify(): boolean {
  return provider() !== null || emailEnabled()
}

/** What an unpaid order is for: its event (from a ticket, else a product), or its item names. */
async function unpaidOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      orderNumber: true, total: true, status: true, whatsappPhone: true, guestPhone: true, email: true,
      user: { select: { phone: true, email: true } },
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
    email: order.email || order.user.email,
    hasTickets: !!ticketEvent,
    what: event?.name ?? order.items.map(i => `${i.quantity}x ${i.name}`).join(', '),
    slug: event?.slug ?? null,
  }
}

// Mobile money only: the PIN prompt arrives on the phone that pays, so that's where this goes.
export async function sendPaymentPendingSms(orderId: string, method: string, payerPhone: string): Promise<void> {
  if (!canNotify() || !['ecocash', 'onemoney'].includes(method)) return
  const order = await unpaidOrder(orderId)
  if (!order) return
  const text = paymentPendingSms({ amount: order.amount, method, what: order.what, hasTickets: order.hasTickets })
  await smsOrEmail(payerPhone, order.email, text, {
    kind: 'transactional', purpose: 'order.pending', reference: order.orderNumber, subject: 'Approve your NXT STOP payment',
  })
}

// Called by whichever of the Paynow webhook or poll flips the order to failed, so it goes once.
export async function sendPaymentFailedSms(orderId: string): Promise<void> {
  if (!canNotify()) return
  const order = await unpaidOrder(orderId)
  if (!order) return
  const text = paymentFailedSms({ amount: order.amount, what: order.what, slug: order.slug })
  await smsOrEmail(order.phone, order.email, text, {
    kind: 'transactional', purpose: 'order.failed', reference: order.orderNumber, subject: 'Your NXT STOP payment did not go through',
  })
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
  if (!canNotify()) return
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true, email: true } })
  if (!user) return
  await smsOrEmail(user.phone, user.email, passwordChangedSms(), {
    kind: 'transactional', purpose: 'auth.password-changed', subject: 'Your NXT STOP password was changed',
  })
}

// Payment confirmed but fulfilOrder failed and will be retried (webhook redelivery, next
// poll, or an admin). Once per order, however many times the retry fails.
export async function sendTicketsDelayedSms(orderId: string): Promise<void> {
  if (!canNotify()) return
  const order = await unpaidOrder(orderId)
  // A webhook and a poll can race: the one that loses may fail after the other fulfilled it
  if (!order || order.status === 'paid' || await alreadyLogged('order.delayed', order.orderNumber)) return
  const text = ticketsDelayedSms({ amount: order.amount, orderNumber: order.orderNumber })
  await smsOrEmail(order.phone, order.email, text, {
    kind: 'transactional', purpose: 'order.delayed', reference: order.orderNumber, subject: 'Your NXT STOP tickets are on their way',
  })
}

export async function sendRefundSms(orderId: string): Promise<void> {
  if (!canNotify()) return
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      orderNumber: true, total: true, paymentMethod: true, whatsappPhone: true, guestPhone: true, email: true,
      user: { select: { phone: true, email: true } },
    },
  })
  if (!order) return
  const text = refundSms({ amount: Number(order.total), orderNumber: order.orderNumber, method: order.paymentMethod ?? 'standard' })
  const phone = order.whatsappPhone || order.guestPhone || order.user.phone
  await smsOrEmail(phone, order.email || order.user.email, text, {
    kind: 'transactional', purpose: 'order.refunded', reference: order.orderNumber, subject: `NXT STOP refund for order ${order.orderNumber}`,
  })
}

const EMAIL_GAP_MS = 500

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
 * who bought since. Goes by email to anyone the SMS can't reach. Returns how many were attempted.
 */
export async function sendEventReminders(now = new Date()): Promise<number> {
  if (!canNotify()) return 0
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
      select: { userId: true, user: { select: { phone: true, email: true } } },
    })
    const done = new Set((await prisma.smsMessage.findMany({
      where: { purpose, reference: { startsWith: `${event.id}:` } },
      select: { reference: true },
    })).map(m => m.reference))
    const args = { eventName: event.name, time: formatDate(event.date, 'HH:mm'), venue: event.venue }
    const text = kind === 'tomorrow' ? eventTomorrowSms(args) : eventTodaySms(args)
    const subject = kind === 'tomorrow' ? `See you tomorrow at ${event.name}` : `Today: ${event.name}`
    for (const h of holders) {
      const reference = `${event.id}:${h.userId}`
      if (done.has(reference)) continue
      const via = await smsOrEmail(h.user.phone, h.user.email, text, { kind: 'transactional', purpose, reference, subject })
      attempted++
      // Keeps a long run of emails under the email service's per-second limit
      if (via === 'email') await new Promise(r => setTimeout(r, EMAIL_GAP_MS))
    }
  }
  return attempted
}

/** Whether an SMS gateway is configured at all (promotional campaigns need it). */
export function smsEnabled(): boolean {
  return provider() !== null
}

/** The code by SMS, or to `email` when the SMS can't go. */
export async function sendLoginCode(phone: string, email: string | null, code: string): Promise<Delivery> {
  return smsOrEmail(phone, email, loginCodeSms({ code, minutes: CODE_TTL_MINUTES }), {
    kind: 'otp', purpose: 'auth.login-code', subject: `${code} is your NXT STOP sign-in code`,
  })
}

/** SMS only — see /api/dashboard/phone/request. */
export async function sendPhoneChangeCode(phone: string, code: string): Promise<SmsResult> {
  return sendSms(phone, phoneChangeCodeSms({ code, minutes: CODE_TTL_MINUTES }), { kind: 'otp', purpose: 'auth.phone-change-code' })
}

export async function sendTicketTransferNotice(o: {
  toPhone: string; toEmail: string | null; senderName: string; eventName: string; eventDate: Date; ticketNumber: string
}): Promise<Delivery> {
  const text = ticketTransferSms({ sender: o.senderName, eventName: o.eventName, eventDate: formatDate(o.eventDate, 'EEE d MMM') })
  return smsOrEmail(o.toPhone, o.toEmail, text, {
    kind: 'transactional', purpose: 'ticket.transfer', reference: o.ticketNumber, subject: `You were sent a ticket for ${o.eventName}`,
  })
}
