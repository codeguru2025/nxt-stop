import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'
import { TZDate } from '@date-fns/tz'

/**
 * All event times belong to the venue's timezone — Central Africa Time (UTC+2, no DST).
 * Dates are stored as true UTC instants in the DB; we always parse and render them in this
 * zone so the result is identical whether the code runs on the server (UTC) or in the browser.
 */
export const EVENT_TIME_ZONE = 'Africa/Harare'

/** View an instant in the event timezone (so date-fns renders CAT wall-clock, not runtime-local). */
function inEventZone(date: Date | string): TZDate {
  return new TZDate(new Date(date), EVENT_TIME_ZONE)
}

/**
 * Convert a wall-clock value from an `<input type="datetime-local">` — which has no timezone and
 * is meant as CAT venue time — into the true UTC instant to persist. CAT is a fixed +02:00 offset.
 */
export function eventLocalInputToUtc(local: string): Date {
  // `local` comes from <input type="datetime-local"> as "YYYY-MM-DDTHH:MM" (optionally with seconds).
  // CAT is a fixed +02:00 offset (Zimbabwe observes no DST), so tagging it makes parsing deterministic.
  // Returns an Invalid Date for malformed input so callers can reject it with a clean error.
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/.exec(local?.trim() ?? '')
  if (!m) return new Date(NaN)
  return new Date(`${m[1]}T${m[2]}:00+02:00`)
}

/** Convert a stored UTC instant back into a datetime-local string in CAT for editing. */
export function utcToEventLocalInput(date: Date | string | null | undefined): string {
  if (!date) return ''
  return format(inEventZone(date), "yyyy-MM-dd'T'HH:mm")
}

/**
 * The UTC instant of venue-local (CAT) midnight on the calendar day `eventDate` falls on.
 * Used to gate "advance" ticket sales (must stop once the event's local day begins) and
 * "gate" ticket sales (must not start before it) — see TicketType.salesChannel.
 */
export function eventDayStartUtc(eventDate: Date | string): Date {
  const day = format(inEventZone(eventDate), 'yyyy-MM-dd')
  return eventLocalInputToUtc(`${day}T00:00`)
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | string, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(Number(amount))
}

export function formatDate(date: Date | string, pattern = 'PPP'): string {
  return format(inEventZone(date), pattern)
}

export function formatDateTime(date: Date | string): string {
  return format(inEventZone(date), 'PPP p')
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function truncate(text: string, length = 100): string {
  if (text.length <= length) return text
  return text.slice(0, length) + '...'
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/** `/r/CODE` lands on the events list; pass an event slug to land on that event instead. */
export function buildReferralUrl(code: string, eventSlug?: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return `${base}/r/${code}${eventSlug ? `?e=${encodeURIComponent(eventSlug)}` : ''}`
}

export function parseReferralCode(url: string): string | null {
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/')
    const idx = parts.indexOf('r')
    if (idx !== -1 && parts[idx + 1]) return parts[idx + 1]
    return null
  } catch {
    return null
  }
}

/** When `endDate` is missing, treat the event as ending this many hours after doors (typical night show). */
export const DEFAULT_EVENT_DURATION_MS = 8 * 60 * 60 * 1000

export type EventTimePhase = 'upcoming' | 'live' | 'ended'

/** When the event is over — its `endDate`, or DEFAULT_EVENT_DURATION_MS after the start. */
export function eventEndTime(start: string | Date, endDate?: string | Date | null): Date {
  return endDate != null && endDate !== ''
    ? new Date(endDate)
    : new Date(new Date(start).getTime() + DEFAULT_EVENT_DURATION_MS)
}

export type TicketChannelWindow = 'open' | 'gate_not_yet' | 'advance_closed'

/**
 * Advance/gate sales window only (not end time or status): advance tickets stop at
 * midnight (venue time) on event day; gate tickets start then; "both" is always open.
 */
export function ticketChannelWindow(
  eventDate: string | Date,
  salesChannel: string | undefined,
  now: number | Date = Date.now()
): TicketChannelWindow {
  const t = typeof now === 'number' ? now : now.getTime()
  const dayStart = eventDayStartUtc(eventDate).getTime()
  if (salesChannel === 'gate' && t < dayStart) return 'gate_not_yet'
  if (salesChannel === 'advance' && t >= dayStart) return 'advance_closed'
  return 'open'
}

/**
 * Lowest price among ticket types that can be bought right now (in stock and inside
 * their sales window) — what "From $X" should show. Falls back to the lowest overall
 * price when nothing is currently on sale, so the card never shows $0.
 */
export function lowestOnSalePrice(
  eventDate: string | Date,
  ticketTypes: { price: number; soldOut?: boolean; salesChannel?: string }[],
  now: number | Date = Date.now()
): number {
  if (ticketTypes.length === 0) return 0
  const onSale = ticketTypes.filter(t =>
    !t.soldOut && ticketChannelWindow(eventDate, t.salesChannel, now) === 'open'
  )
  return Math.min(...(onSale.length ? onSale : ticketTypes).map(t => t.price))
}

/**
 * Why this ticket type can't be sold right now, or null if it can. Server-side source
 * of truth shared by online checkout and cash sales of printed tickets at the desk:
 * nothing sells once the event is cancelled/ended or past its end time; advance tickets
 * stop at midnight (venue time) on event day; gate tickets only sell from that moment.
 */
export function ticketSalesClosedReason(
  event: { date: string | Date; endDate?: string | Date | null; status: string },
  salesChannel: string,
  now: Date = new Date()
): string | null {
  if (event.status === 'cancelled' || event.status === 'ended') return 'Ticket sales for this event are closed'
  if (now > eventEndTime(event.date, event.endDate)) return 'This event has ended — ticket sales are closed'
  const window = ticketChannelWindow(event.date, salesChannel, now)
  if (window === 'advance_closed') return 'Advance sales have closed — this ticket is available at the gate on the day'
  if (window === 'gate_not_yet') return 'This ticket type goes on sale on the day of the event'
  return null
}

/** Derive coming soon / live / ended from wall-clock time (not only DB `status`). */
export function getEventTimePhase(
  start: string | Date,
  endDate?: string | Date | null
): EventTimePhase {
  const startMs = new Date(start).getTime()
  const endMs = eventEndTime(start, endDate).getTime()
  const now = Date.now()
  if (now < startMs) return 'upcoming'
  if (now < endMs) return 'live'
  return 'ended'
}
