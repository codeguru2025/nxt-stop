import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'

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
  return format(new Date(date), pattern)
}

export function formatDateTime(date: Date | string): string {
  return format(new Date(date), 'PPP p')
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
