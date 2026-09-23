import webpush from 'web-push'
import { prisma } from './db'
import { env } from './env'

export type PushPayload = {
  title: string
  body: string
  url?: string // opened when the notification is tapped
  tag?: string // same tag replaces an earlier notification instead of stacking
}

let configured: boolean | null = null

/** False when VAPID keys aren't set — push then silently no-ops, like email without Resend. */
export function pushConfigured(): boolean {
  if (configured !== null) return configured
  const pub = env.VAPID_PUBLIC_KEY
  const priv = env.VAPID_PRIVATE_KEY
  if (!pub || !priv) {
    console.warn('[push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set — admin push alerts disabled')
    configured = false
    return false
  }
  webpush.setVapidDetails(env.VAPID_SUBJECT, pub, priv)
  configured = true
  return true
}

/**
 * Sends a Web Push notification to every device of every admin account — or only of the
 * admins in `opts.userIds` when given. Never throws: alerts are best-effort and must not
 * break the request that triggered them.
 */
export async function notifyAdmins(payload: PushPayload, opts: { userIds?: string[] } = {}): Promise<void> {
  try {
    if (!pushConfigured()) return
    if (opts.userIds && opts.userIds.length === 0) return
    const subs = await prisma.pushSubscription.findMany({
      where: { user: { role: 'admin' }, ...(opts.userIds && { userId: { in: opts.userIds } }) },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    })
    const body = JSON.stringify(payload)
    const gone: string[] = []
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 })
        } catch (err: unknown) {
          const status = (err as { statusCode?: number })?.statusCode
          // 404/410: the browser unsubscribed or the subscription expired — drop it
          if (status === 404 || status === 410) gone.push(s.id)
          else console.error('[push] send failed', status, (err as Error)?.message)
        }
      })
    )
    if (gone.length) await prisma.pushSubscription.deleteMany({ where: { id: { in: gone } } })
  } catch (err) {
    console.error('[push] notifyAdmins failed', err)
  }
}

/** Alert all admins that a customer's payment failed. */
export async function notifyAdminsPaymentFailed(orderId: string): Promise<void> {
  const order = await prisma.order
    .findUnique({
      where: { id: orderId },
      select: {
        orderNumber: true, total: true, paymentMethod: true, whatsappName: true, guestName: true,
        user: { select: { name: true } },
      },
    })
    .catch(() => null)
  if (!order) return
  const who = order.whatsappName ?? order.guestName ?? order.user?.name ?? 'A customer'
  await notifyAdmins({
    title: 'Payment failed',
    body: `${who} — $${Number(order.total).toFixed(2)}${order.paymentMethod ? ` via ${order.paymentMethod}` : ''} (order ${order.orderNumber})`,
    url: '/admin/tickets',
    tag: `payment-failed-${order.orderNumber}`,
  })
}
