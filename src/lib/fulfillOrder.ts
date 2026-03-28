import { prisma } from './db'
import { generateTicketNumber } from './qr'
import crypto from 'crypto'

export async function fulfillOrder(orderId: string, paymentMethod: string, paymentRef?: string) {
  await prisma.$transaction(async (tx) => {
    // Idempotency guard: only proceed if order is still pending.
    // updateMany returns a count — if 0, another process already fulfilled it.
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: 'pending' },
      data: { status: 'paid', paymentMethod, paymentRef: paymentRef ?? null, paidAt: new Date() },
    })
    if (count === 0) return // already fulfilled or cancelled — nothing to do

    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { ticketType: { include: { event: true } } } },
      },
    })
    if (!order) return

    const ticketItems = order.items.filter(i => !i.productId)

    for (const item of ticketItems) {
      // Use stored ticketTypeId relation if available, fall back to name-matching
      let ticketType: { id: string; eventId: string; [key: string]: any } | null = item.ticketType ?? null
      if (!ticketType && item.name) {
        const [typeName] = item.name.split(' - ')
        ticketType = await tx.ticketType.findFirst({
          where: { name: typeName },
          include: { event: true },
        })
      }
      if (!ticketType) continue

      for (let i = 0; i < item.quantity; i++) {
        const ticketNumber = generateTicketNumber()
        const qrPayload = crypto.randomUUID()

        await tx.ticket.create({
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

      await tx.ticketType.update({
        where: { id: ticketType.id },
        data: { sold: { increment: item.quantity } },
      })
    }

    // Award referral points
    if (order.referralCode) {
      const referrer = await tx.user.findUnique({ where: { referralCode: order.referralCode } })
      if (referrer && referrer.id !== order.userId) {
        const config = await tx.pointsConfig.findFirst({ where: { active: true } })
        const pointsPerSale = config?.pointsPerSale ?? 10
        const bonus = config?.bonusMultiplier ?? 1.0
        const totalQty = ticketItems.reduce((s, i) => s + i.quantity, 0)
        const points = Math.round(pointsPerSale * totalQty * bonus)

        await tx.user.update({
          where: { id: referrer.id },
          data: { points: { increment: points }, totalEarned: { increment: points } },
        })

        await tx.referral.create({
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
      const partner = await tx.partner.findUnique({ where: { id: order.partnerId } })
      if (partner) {
        const commissionAmount = order.subtotal * (partner.commissionRate / 100)
        await tx.commission.create({
          data: { partnerId: order.partnerId, orderId: order.id, amount: commissionAmount },
        })
        await tx.partner.update({
          where: { id: order.partnerId },
          data: {
            totalSales: { increment: ticketItems.reduce((s, i) => s + i.quantity, 0) },
            totalEarned: { increment: commissionAmount },
          },
        })
      }
    }
  }, {
    timeout: 15000, // 15s — generous for ticket batch creation
  })
}
