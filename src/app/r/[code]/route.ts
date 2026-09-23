import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { env } from '@/lib/env'
import {
  VISITOR_COOKIE, REF_COOKIE, visitorCookieOptions, refCookieOptions,
  isBot, deviceOf, sourceOf, hashIp, newVisitorId, clientIp, validReferralCode, recordPageView,
} from '@/lib/visits'

// GET /r/CODE — referral link. Counts the click (humans only — link-preview robots from
// WhatsApp/Facebook are ignored), remembers the link for 30 days so a purchase made later
// on another page is still credited, then sends the visitor to the events page.
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code: raw } = await ctx.params
  const code = await validReferralCode(raw).catch(() => null)
  const res = NextResponse.redirect(new URL(code ? `/events?ref=${encodeURIComponent(code)}` : '/events', req.url))
  if (!code) return res

  const cookieHeader = req.headers.get('cookie') ?? ''
  const existingVisitor = /(?:^|;\s*)nxt-vid=([^;]+)/.exec(cookieHeader)?.[1]
  const visitorId = existingVisitor ?? newVisitorId()
  if (!existingVisitor) res.cookies.set(VISITOR_COOKIE, visitorId, visitorCookieOptions)
  res.cookies.set(REF_COOKIE, code, refCookieOptions)

  const ua = req.headers.get('user-agent')
  if (!isBot(ua)) {
    const session = await getSession().catch(() => null)
    await recordPageView({
      path: `/r/${code}`,
      visitorId,
      userId: session?.id ?? null,
      referralCode: code,
      source: sourceOf(req.headers.get('referer'), ua, new URL(env.APP_URL).hostname),
      device: deviceOf(ua),
      ipHash: hashIp(clientIp(req)),
    }).catch(err => console.error('[visits] click not recorded', err))
  }
  return res
}
