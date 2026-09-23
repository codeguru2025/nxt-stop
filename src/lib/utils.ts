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

export function buildReferralUrl(code: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return `${base}/r/${code}`
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
const DEFAULT_EVENT_DURATION_MS = 8 * 60 * 60 * 1000

export type EventTimePhase = 'upcoming' | 'live' | 'ended'

/** Derive coming soon / live / ended from wall-clock time (not only DB `status`). */
export function getEventTimePhase(
  start: string | Date,
  endDate?: string | Date | null
): EventTimePhase {
  const startMs = new Date(start).getTime()
  const endMs = endDate != null && endDate !== ''
    ? new Date(endDate).getTime()
    : startMs + DEFAULT_EVENT_DURATION_MS
  const now = Date.now()
  if (now < startMs) return 'upcoming'
  if (now < endMs) return 'live'
  return 'ended'
}
