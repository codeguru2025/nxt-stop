import { prisma } from './db'

/**
 * What happens by email alongside an automatic SMS:
 * always: its own email goes out regardless of the SMS (tickets, one-time password, ...)
 * fallback: the SMS text is emailed instead whenever the SMS can't go (see smsOrEmail)
 */
export type EmailCover = 'always' | 'fallback'

/**
 * The automatic SMS an admin can switch off. Not here: promotional campaigns (sent by hand)
 * and the phone-change code, which must reach the new number by SMS to prove it's theirs.
 */
export const AUTO_SMS = [
  { key: 'order.paid', label: 'Payment confirmed', when: 'An order is paid', email: 'always' },
  { key: 'order.pending', label: 'Approve payment prompt', when: 'An EcoCash/OneMoney payment starts', email: 'fallback' },
  { key: 'order.failed', label: 'Payment failed', when: 'A Paynow payment fails', email: 'fallback' },
  { key: 'order.delayed', label: 'Tickets delayed', when: 'Paid, but issuing the tickets failed and will be retried', email: 'fallback' },
  { key: 'order.refunded', label: 'Refund', when: 'An admin refunds an order', email: 'fallback' },
  { key: 'account.welcome', label: 'Welcome / one-time password', when: 'Checkout or a gate sale creates an account', email: 'always' },
  { key: 'lineup.login', label: 'Line-up login', when: 'A line-up member is given a password', email: 'always' },
  { key: 'auth.password-reset', label: 'Password reset link', when: 'Someone asks to reset their password', email: 'always' },
  { key: 'auth.password-changed', label: 'Password changed', when: 'A password is changed or reset', email: 'fallback' },
  { key: 'auth.login-code', label: 'Login code', when: 'Someone signs in with a one-time code', email: 'fallback' },
  { key: 'referral.reward', label: 'Referral reward', when: 'A referral earns a reward', email: 'always' },
  { key: 'ticket.transfer', label: 'Ticket transfer', when: 'Someone is sent a ticket', email: 'fallback' },
  { key: 'event.reminder', label: 'Event reminders', when: 'Day before (from noon) and on the day (from 9am)', email: 'fallback' },
] as const satisfies readonly { key: string; label: string; when: string; email: EmailCover }[]

export type AutoSmsKey = (typeof AUTO_SMS)[number]['key']

const KEYS = new Set<string>(AUTO_SMS.map(m => m.key))
const SETTING_KEY = 'sms.switchedOff'

/** The switch a message purpose falls under: both event reminders share one. */
export function switchFor(purpose: string): string {
  return purpose.startsWith('event.reminder-') ? 'event.reminder' : purpose
}

/**
 * On until an admin changes them: payment confirmation, plus the one-time passwords and codes
 * people need to get into their account. Everything else starts off (so goes by email) and
 * is switched on from /admin/sms as credits allow.
 */
const ON_BY_DEFAULT = new Set<string>(['order.paid', 'account.welcome', 'lineup.login', 'auth.login-code'])
const DEFAULT_OFF = AUTO_SMS.map(m => m.key as string).filter(k => !ON_BY_DEFAULT.has(k))

/**
 * Automatic SMS switched off on /admin/sms — the defaults above until an admin saves a
 * choice. Never throws: if the setting can't be read, the defaults apply.
 */
export async function smsSwitchedOff(): Promise<Set<string>> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } })
    const keys: unknown = row ? JSON.parse(row.value) : DEFAULT_OFF
    return new Set(Array.isArray(keys) ? keys.filter((k): k is string => typeof k === 'string' && KEYS.has(k)) : DEFAULT_OFF)
  } catch (err) {
    console.error('[sms] could not read which SMS are switched off — using the defaults', err)
    return new Set(DEFAULT_OFF)
  }
}

export async function isSmsSwitchedOff(purpose: string): Promise<boolean> {
  return (await smsSwitchedOff()).has(switchFor(purpose))
}

/** Saves the full set of switched-off messages; unknown keys are dropped. */
export async function setSmsSwitchedOff(keys: string[]): Promise<string[]> {
  const value = [...new Set(keys.filter(k => KEYS.has(k)))].sort()
  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: JSON.stringify(value) },
    update: { value: JSON.stringify(value) },
  })
  return value
}
