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
    (items, tail) => `NXT STOP: Payment of ${money(o.amount)} received for ${items}. Show your voucher codes at the bar or stand: ${smsHost()}/dashboard/purchases${tail}`,
    o.items,
    ` Order ${o.orderNumber}`,
  )
}
