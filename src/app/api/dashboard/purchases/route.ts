import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { ok, unauthorized, serverError } from '@/lib/api'
import { generateQRDataURL } from '@/lib/qr'

// GET /api/dashboard/purchases — the logged-in user's order history plus the vouchers
// (drink/liquor, merch, tables) those orders minted. QR images are rendered server-side
// for unredeemed vouchers only, so the page doesn't hit the rate-limited /api/qr per item.
export async function GET() {
  try {
    const session = await requireAuth().catch(() => null)
    if (!session) return unauthorized()

    const [orders, vouchers] = await Promise.all([
      prisma.order.findMany({
        // Pending orders are unpaid checkouts still in progress (or abandoned) — not purchases.
        where: { userId: session.id, status: { not: 'pending' } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true, orderNumber: true, status: true, total: true, paymentMethod: true,
          createdAt: true, paidAt: true,
          items: { select: { name: true, quantity: true, price: true } },
        },
      }),
      prisma.voucher.findMany({
        where: { userId: session.id, order: { status: 'paid' } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, code: true, qrCode: true, status: true, redeemedAt: true, orderId: true,
          product: {
            select: {
              name: true, category: true, isTable: true, capacityPerUnit: true,
              event: { select: { name: true, date: true, venue: true } },
            },
          },
        },
      }),
    ])

    const vouchersWithQr = await Promise.all(
      vouchers.map(async ({ qrCode, ...v }) => ({
        ...v,
        qrDataUrl: v.status === 'unredeemed' ? await generateQRDataURL(qrCode) : null,
      }))
    )

    return ok({
      orders: orders.map(o => ({
        ...o,
        total: Number(o.total),
        items: o.items.map(i => ({ ...i, price: Number(i.price) })),
      })),
      vouchers: vouchersWithQr,
    })
  } catch (e) {
    return serverError(e)
  }
}
