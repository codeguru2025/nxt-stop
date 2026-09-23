import crypto from 'crypto'
import { prisma } from './db'
import { env } from './env'

// Site-visit tracking: page views and referral-link clicks (PageView table).

export const VISITOR_COOKIE = 'nxt-vid'
export const REF_COOKIE = 'nxt-ref'
export const REF_COOKIE_DAYS = 30
export const VISIT_RETENTION_DAYS = 90

const ONE_YEAR = 60 * 60 * 24 * 365
export const visitorCookieOptions = { httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: ONE_YEAR, secure: process.env.NODE_ENV === 'production' }
export const refCookieOptions = { httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * REF_COOKIE_DAYS, secure: process.env.NODE_ENV === 'production' }

/**
 * Link-preview robots (WhatsApp, Facebook, Telegram…) fetch a shared link the moment it's
 * posted — counting them would make every share look like a click. Search crawlers too.
 */
export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true
  return /bot|crawl|spider|slurp|preview|facebookexternalhit|facebookcatalog|whatsapp\/|telegram|discord|skype|embedly|quora link|pinterest|vkshare|headless|lighthouse|curl|wget|python-requests|axios|node-fetch/i.test(userAgent)
}

export function deviceOf(userAgent: string | null | undefined): 'mobile' | 'tablet' | 'desktop' {
  const ua = userAgent ?? ''
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return 'tablet'
  if (/mobi|iphone|android/i.test(ua)) return 'mobile'
  return 'desktop'
}

/** Where a visitor came from, in words an owner recognises. */
export function sourceOf(referrer: string | null | undefined, userAgent: string | null | undefined, siteHost: string): string {
  const ua = userAgent ?? ''
  // In-app browsers often send no referrer, but say who they are in the user agent
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'facebook'
  if (/Instagram/i.test(ua)) return 'instagram'
  if (/TikTok|musical_ly|BytedanceWebview/i.test(ua)) return 'tiktok'
  if (/Snapchat/i.test(ua)) return 'snapchat'
  let host = ''
  try { host = referrer ? new URL(referrer).hostname.toLowerCase() : '' } catch { host = '' }
  if (!host || host === siteHost || host.endsWith(`.${siteHost}`)) return 'direct'
  if (/whatsapp|wa\.me/.test(host)) return 'whatsapp'
  if (/facebook|fb\.com|fb\.me/.test(host)) return 'facebook'
  if (/instagram/.test(host)) return 'instagram'
  if (/tiktok/.test(host)) return 'tiktok'
  if (/(^|\.)t\.co$|twitter|x\.com/.test(host)) return 'x (twitter)'
  if (/google\./.test(host)) return 'google'
  if (/bing\.|duckduckgo|yahoo\./.test(host)) return 'search'
  if (/t\.me|telegram/.test(host)) return 'telegram'
  return host.replace(/^www\./, '')
}

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null
  return crypto.createHash('sha256').update(`visit-ip:${env.JWT_SECRET}:${ip}`).digest('hex').slice(0, 24)
}

export function newVisitorId(): string {
  return crypto.randomBytes(12).toString('base64url')
}

export function clientIp(req: Request): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
}

/** A referral code that belongs to a customer or a partner, or null. */
export async function validReferralCode(code: string | null | undefined): Promise<string | null> {
  if (!code || code.length > 40 || !/^[A-Za-z0-9_-]+$/.test(code)) return null
  const [user, partner] = await Promise.all([
    prisma.user.findUnique({ where: { referralCode: code }, select: { id: true } }),
    prisma.partner.findUnique({ where: { referralCode: code }, select: { id: true } }),
  ])
  return user || partner ? code : null
}

/**
 * Records one visit. Repeat hits on the same page by the same visitor within 10 seconds
 * (reloads, double beacons) are ignored. Occasionally prunes rows past the retention window.
 */
export async function recordPageView(v: {
  path: string
  visitorId: string
  userId?: string | null
  referralCode?: string | null
  source?: string | null
  device?: string | null
  ipHash?: string | null
}): Promise<void> {
  const recent = await prisma.pageView.findFirst({
    where: { visitorId: v.visitorId, path: v.path, createdAt: { gt: new Date(Date.now() - 10_000) } },
    select: { id: true },
  })
  if (recent) return
  await prisma.pageView.create({
    data: {
      path: v.path.slice(0, 300),
      visitorId: v.visitorId,
      userId: v.userId ?? null,
      referralCode: v.referralCode ?? null,
      source: v.source?.slice(0, 60) ?? null,
      device: v.device ?? null,
      ipHash: v.ipHash ?? null,
    },
  })
  if (Math.random() < 0.002) {
    void prisma.pageView
      .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - VISIT_RETENTION_DAYS * 86_400_000) } } })
      .catch(() => {})
  }
}
