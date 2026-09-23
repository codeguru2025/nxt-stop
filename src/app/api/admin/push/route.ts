import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, error, forbidden, serverError } from '@/lib/api'
import { env } from '@/lib/env'

// Every admin receives admin alerts (e.g. failed payments), so these routes are not
// capability-gated — any admin can turn alerts on for their own devices.

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
})

// GET /api/admin/push?endpoint=… — public key for subscribing + whether this device is on
export async function GET(req: Request) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()
    const endpoint = new URL(req.url).searchParams.get('endpoint')
    const subscribed = endpoint
      ? !!(await prisma.pushSubscription.findFirst({ where: { endpoint, userId: session.id }, select: { id: true } }))
      : false
    return ok({ publicKey: env.VAPID_PUBLIC_KEY ?? null, subscribed })
  } catch (e) {
    return serverError(e)
  }
}

// POST /api/admin/push — save this device's subscription for the logged-in admin
export async function POST(req: Request) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()
    const parsed = subscriptionSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return error('Invalid push subscription')
    const { endpoint, keys } = parsed.data
    const userAgent = req.headers.get('user-agent')?.slice(0, 300) ?? null
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId: session.id, userAgent },
      update: { p256dh: keys.p256dh, auth: keys.auth, userId: session.id, userAgent },
    })
    return ok({ subscribed: true })
  } catch (e) {
    return serverError(e)
  }
}

// DELETE /api/admin/push — turn alerts off for this device
export async function DELETE(req: Request) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()
    const { endpoint } = await req.json().catch(() => ({}))
    if (typeof endpoint !== 'string') return error('endpoint is required')
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: session.id } })
    return ok({ subscribed: false })
  } catch (e) {
    return serverError(e)
  }
}
