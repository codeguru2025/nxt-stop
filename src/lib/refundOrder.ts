import { prisma } from './db'

/**
 * Records a refund the team has already paid back outside the app (EcoCash, Paynow
 * dashboard...): the order becomes refunded, its tickets and vouchers stop working and
 * go back on sale, and a referral reward not yet paid out is cancelled.
 * Refused once a ticket was scanned or a voucher redeemed — that part was used.
 */
export async function refundOrder(orderId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        status: true,
        tickets: { select: { status: true, ticketTypeId: true } },
        vouchers: { select: { status: true, productId: true } },
      },
    })
    if (!order) return { ok: false as const, reason: 'Order not found' }
    if (order.status !== 'paid') return { ok: false as const, reason: `Only paid orders can be refunded (this one is ${order.status})` }
    if (order.tickets.some(t => t.status === 'used')) return { ok: false as const, reason: 'A ticket on this order was already scanned at the gate' }
    if (order.vouchers.some(v => v.status === 'redeemed')) return { ok: false as const, reason: 'A voucher on this order was already redeemed' }

    const count = <K extends string>(keys: K[]) => {
      const m = new Map<K, number>()
      for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1)
      return m
    }
    const validTickets = order.tickets.filter(t => t.status === 'valid')
    for (const [ticketTypeId, n] of count(validTickets.map(t => t.ticketTypeId))) {
      await tx.ticketType.update({ where: { id: ticketTypeId }, data: { sold: { decrement: n } } })
    }
    const openVouchers = order.vouchers.filter(v => v.status === 'unredeemed')
    for (const [productId, n] of count(openVouchers.map(v => v.productId))) {
      await tx.product.update({ where: { id: productId }, data: { sold: { decrement: n } } })
    }

    await tx.ticket.updateMany({ where: { orderId, status: 'valid' }, data: { status: 'refunded' } })
    await tx.voucher.updateMany({ where: { orderId, status: 'unredeemed' }, data: { status: 'cancelled' } })
    await tx.referralReward.updateMany({ where: { orderId, status: 'pending' }, data: { status: 'cancelled' } })
    await tx.order.update({ where: { id: orderId }, data: { status: 'refunded' } })
    return { ok: true as const }
  })
}
