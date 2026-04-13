import { prisma } from './db'
import { generateTicketNumber } from './qr'
import { sendOrderTicketsWhatsApp } from './whatsapp'
import crypto from 'crypto'

export async function fulfillOrder(orderId: string, paymentMethod: string, paymentRef?: string) {
  let ticketsMinted = false
  await prisma.$transaction(async (tx) => {
    // Serialize fulfillment for this order (pending payment vs paid-without-tickets repair).
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE
    `
    if (!locked.length) return

    if ((await tx.ticket.count({ where: { orderId } })) > 0) {
      return
    }

    const orderRow = await tx.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    })
    if (!orderRow) return
    if (orderRow.status !== 'pending' && orderRow.status !== 'paid') {
      return
    }

    if (orderRow.status === 'pending') {
      const { count } = await tx.order.updateMany({
        where: { id: orderId, status: 'pending' },
        data: {
          status: 'paid',
          paymentMethod,
          paymentRef: paymentRef ?? null,
          paidAt: new Date(),
        },
      })
      if (count === 0) return
    } else {
      // Repair: order is paid but has no tickets (failed mint, manual fix, etc.)
      const patch: { paymentMethod?: string; paymentRef?: string | null } = {}
      if (paymentMethod) patch.paymentMethod = paymentMethod
      if (paymentRef !== undefined) patch.paymentRef = paymentRef ?? null
      if (Object.keys(patch).length > 0) {
        await tx.order.update({ where: { id: orderId }, data: patch })
      }
    }

    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { ticketType: { include: { event: true } } } },
      },
    })
    if (!order || order.status !== 'paid') return

    const ticketItems = order.items.filter(i => !i.productId)
    if (ticketItems.length === 0) return

    for (const item of ticketItems) {
      let ticketType: { id: string; eventId: string; capacity: number; sold: number; [key: string]: any } | null =
        item.ticketType ?? null
      if (!ticketType && item.ticketTypeId) {
        ticketType = await tx.ticketType.findUnique({
          where: { id: item.ticketTypeId },
          include: { event: true },
        })
      }
      if (!ticketType && item.name) {
        const [typeName, eventName] = item.name.split(' - ')
        ticketType = await tx.ticketType.findFirst({
          where: {
            name: typeName,
            ...(eventName ? { event: { name: { contains: eventName, mode: 'insensitive' as const } } } : {}),
          },
          include: { event: true },
        })
      }
      if (!ticketType) throw new Error(`Ticket type not found for order item ${item.id} — fulfillment aborted`)

      await tx.$executeRaw`SELECT id FROM "TicketType" WHERE id = ${ticketType.id} FOR UPDATE`
      const freshType = await tx.ticketType.findUnique({
        where: { id: ticketType.id },
        select: { id: true, sold: true, capacity: true },
      })
      if (!freshType) throw new Error(`Ticket type ${ticketType.id} missing — fulfillment aborted`)
      if (freshType.sold + item.quantity > freshType.capacity) {
        throw new Error(
          `Cannot fulfill order ${orderId}: only ${freshType.capacity - freshType.sold} seat(s) left for this ticket type (need ${item.quantity})`
        )
      }

      const ticketRows = Array.from({ length: item.quantity }, () => ({
        ticketNumber: generateTicketNumber(),
        qrCode: crypto.randomUUID(),
        userId: order.userId,
        eventId: ticketType!.eventId,
        ticketTypeId: ticketType!.id,
        orderId: order.id,
        partnerId: order.partnerId ?? null,
        referralCode: order.referralCode ?? null,
      }))

      await tx.ticket.createMany({ data: ticketRows })

      await tx.ticketType.update({
        where: { id: ticketType.id },
        data: { sold: { increment: item.quantity } },
      })
      ticketsMinted = true
    }

    if (order.referralCode) {
      const existingRef = await tx.referral.findFirst({ where: { orderId: order.id } })
      if (!existingRef) {
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
    }

    if (order.partnerId) {
      const existingComm = await tx.commission.findFirst({
        where: { orderId: order.id, partnerId: order.partnerId },
      })
      if (!existingComm) {
        const partner = await tx.partner.findUnique({ where: { id: order.partnerId } })
        if (partner) {
          const totalQty = ticketItems.reduce((s, i) => s + i.quantity, 0)
          const perTicket = Number(partner.commissionPerTicket)
          const commissionAmount = perTicket > 0
            ? perTicket * totalQty
            : Number(order.subtotal) * (Number(partner.commissionRate) / 100)
          await tx.commission.create({
            data: { partnerId: order.partnerId, orderId: order.id, amount: commissionAmount },
          })
          await tx.partner.update({
            where: { id: order.partnerId },
            data: {
              totalSales: { increment: totalQty },
              totalEarned: { increment: commissionAmount },
            },
          })
        }
      }
    }
  }, {
    timeout: 15000,
  })

  if (ticketsMinted) {
    sendOrderTicketsWhatsApp(orderId).catch((err) => {
      console.error(`WhatsApp delivery failed for order ${orderId}`, err)
    })
  }
}
