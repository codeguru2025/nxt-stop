import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSession } from '@/lib/auth'
import { env } from '@/lib/env'
import {
  VISITOR_COOKIE, REF_COOKIE, visitorCookieOptions, refCookieOptions,
  isBot, deviceOf, sourceOf, hashIp, newVisitorId, clientIp, validReferralCode, recordPageView,
} from '@/lib/visits'

// POST /api/track { path, referrer } — one page view, sent by <PageTracker /> on every
// navigation. CSRF-exempt (see middleware): it can only ever add an anonymous visit row.
export async function POST(req: Request) {
  const res = NextResponse.json({ success: true })
  try {
    const ua = req.headers.get('user-agent')
    if (isBot(ua)) return res

    const body = await req.json().catch(() => ({}))
    const raw = typeof body?.path === 'string' ? body.path : ''
    if (!raw.startsWith('/') || raw.length > 500) return res
    const url = new URL(raw, 'http://x')
    const path = url.pathname

    const jar = await cookies()
    let visitorId = jar.get(VISITOR_COOKIE)?.value
    if (!visitorId || visitorId.length > 40) {
      visitorId = newVisitorId()
      res.cookies.set(VISITOR_COOKIE, visitorId, visitorCookieOptions)
    }

    // ?ref=CODE on the page (e.g. an event link someone shared) starts/renews the 30-day
    // credit; otherwise the visit is credited to the link they came in on, if any.
    let referralCode = await validReferralCode(url.searchParams.get('ref')).catch(() => null)
    if (referralCode) res.cookies.set(REF_COOKIE, referralCode, refCookieOptions)
    else referralCode = jar.get(REF_COOKIE)?.value ?? null

    const session = await getSession().catch(() => null)
    await recordPageView({
      path,
      visitorId,
      userId: session?.id ?? null,
      referralCode,
      source: sourceOf(typeof body?.referrer === 'string' ? body.referrer : null, ua, new URL(env.APP_URL).hostname),
      device: deviceOf(ua),
      ipHash: hashIp(clientIp(req)),
    })
  } catch (err) {
    console.error('[visits] page view not recorded', err)
  }
  return res
}
