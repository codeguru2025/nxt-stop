import { NextResponse, type NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'
import { env } from '@/lib/env'
import { prisma } from '@/lib/db'
import {
  VISITOR_COOKIE, REF_COOKIE, visitorCookieOptions, refCookieOptions,
  isBot, deviceOf, sourceOf, hashIp, newVisitorId, clientIp, validReferralCode, recordPageView,
} from '@/lib/visits'

// Only slugs of events the public can see — never an arbitrary path, so the link can't be
// used as an open redirect. A link made while the event is still a draft lands on the
// events list until it's published (same statuses as getPublicEventDetailForPage).
async function eventSlug(raw: string | null): Promise<string | null> {
  if (!raw || raw.length > 120 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null
  const ev = await prisma.event.findFirst({
    where: { slug: raw, status: { in: ['published', 'live', 'ended'] } },
    select: { slug: true },
  }).catch(() => null)
  return ev?.slug ?? null
}

// GET /r/CODE[?e=event-slug] — referral link. Counts the click (humans only — link-preview
// robots from WhatsApp/Facebook are ignored), remembers the link for 30 days so a purchase
// made later on another page is still credited, then sends the visitor to the events page,
// or straight to one event when the link was shared from that event's page.
export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code: raw } = await ctx.params
  const [code, slug] = await Promise.all([
    validReferralCode(raw).catch(() => null),
    eventSlug(req.nextUrl.searchParams.get('e')),
  ])
  const dest = slug ? `/events/${slug}` : '/events'
  const res = NextResponse.redirect(new URL(code ? `${dest}?ref=${encodeURIComponent(code)}` : dest, req.url))
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
