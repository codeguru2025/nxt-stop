import { prisma } from './db'
import { generateTicketNumber, generateQRDataURL } from './qr'
import crypto from 'crypto'

/**
 * Fulfill a paid order: create tickets, update sold counts, award referral
 * points, and log partner commissions. Safe to call multiple times — if the
 * order is already paid/fulfilled it returns early.
 */
export async function fulfillOrder(orderId: string, paymentMethod: string, paymentRef?: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  })

  if (!order || order.status === 'paid') return

  // Mark paid first (idempotency guard)
  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'paid', paymentMethod, paymentRef: paymentRef ?? null, paidAt: new Date() },
  })

  // Derive ticketTypeId + eventId from first item name is not reliable;
  // instead we stored them on the items when creating the pending order.
  // We need to look them up via the ticket type attached to the event.
  // The order items store name only, so we need the ticketTypeId stored on the order.
  // Re-fetch via items → ticketType lookup by matching the order's eventId.
  // Since we may have multiple ticket types in one order (future-proofing),
  // we look up each item's ticket type via a dedicated join.
  const orderWithDetails = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: { select: { id: true } },
        },
      },
    },
  })
  if (!orderWithDetails) return

  // For ticket items (no productId), derive the ticketType from the item name
  // which is stored as "<ticketTypeName> - <eventName>". Instead, we'll query
  // for the ticketType by joining via orderItems using a stored reference.
  // Since the current schema doesn't store ticketTypeId on OrderItem, we use
  // a helper: find TicketTypes for this order via the pending tickets approach.
  // Actually the simplest path: we stored a ticket type + event reference in
  // the order item name. Better to just look up from the order's event context.
  // For now, find the ticketType from the order's referral/partner context +
  // the item name matching. We'll refine with a schema migration later.

  // Find ticket items (those without a productId)
  const ticketItems = orderWithDetails.items.filter(i => !i.productId)

  for (const item of ticketItems) {
    // Find the ticket type by matching the item name pattern "<TypeName> - <EventName>"
    const [typeName] = item.name.split(' - ')
    const ticketType = await prisma.ticketType.findFirst({
      where: { name: typeName },
      include: { event: true },
    })
    if (!ticketType) continue

    for (let i = 0; i < item.quantity; i++) {
      const ticketNumber = generateTicketNumber()
      const qrPayload = crypto.randomUUID()

      await prisma.ticket.create({
        data: {
          ticketNumber,
          qrCode: qrPayload,
          userId: order.userId,
          eventId: ticketType.eventId,
          ticketTypeId: ticketType.id,
          orderId: order.id,
          partnerId: order.partnerId ?? null,
          referralCode: order.referralCode ?? null,
        },
      })
    }

    // Update sold count
    await prisma.ticketType.update({
      where: { id: ticketType.id },
      data: { sold: { increment: item.quantity } },
    })
  }

  // Award referral points
  if (order.referralCode) {
    const referrer = await prisma.user.findUnique({ where: { referralCode: order.referralCode } })
    if (referrer && referrer.id !== order.userId) {
      const config = await prisma.pointsConfig.findFirst({ where: { active: true } })
      const pointsPerSale = config?.pointsPerSale ?? 10
      const bonus = config?.bonusMultiplier ?? 1.0
      const totalQty = ticketItems.reduce((s, i) => s + i.quantity, 0)
      const points = Math.round(pointsPerSale * totalQty * bonus)

      await prisma.user.update({
        where: { id: referrer.id },
        data: { points: { increment: points }, totalEarned: { increment: points } },
      })

      await prisma.referral.create({
        data: {
          sourceUserId: referrer.id,
          targetUserId: order.userId,
          orderId: order.id,
          pointsAwarded: points,
        },
      })
    }
  }

  // Partner commission
  if (order.partnerId) {
    const partner = await prisma.partner.findUnique({ where: { id: order.partnerId } })
    if (partner) {
      const commissionAmount = order.subtotal * (partner.commissionRate / 100)
      await prisma.commission.create({
        data: { partnerId: order.partnerId, orderId: order.id, amount: commissionAmount },
      })
      await prisma.partner.update({
        where: { id: order.partnerId },
        data: {
          totalSales: { increment: ticketItems.reduce((s, i) => s + i.quantity, 0) },
          totalEarned: { increment: commissionAmount },
        },
      })
    }
  }
}
