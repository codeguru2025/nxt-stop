import { prisma } from '@/lib/db'
import { requireCapability } from '@/lib/auth'
import { ok, error, forbidden, serverError } from '@/lib/api'
import { fulfillOrder } from '@/lib/fulfillOrder'
import { pollPaynowTransaction } from '@/lib/paynow'
import { sendOrderTicketsWhatsApp } from '@/lib/whatsapp'
import { sendOrderConfirmationEmail } from '@/lib/email'
import { normalizeWhatsAppPhone } from '@/lib/phone'
import { env } from '@/lib/env'

// GET /api/admin/orders?search=&status=&page=
export async function GET(req: Request) {
  try {
    const session = await requireCapability('tickets').catch(() => null)
    if (!session) return forbidden()

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') ?? ''
    const status = searchParams.get('status') ?? ''
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1') || 1)
    const limit = 50

    const where: any = {}
    if (status) where.status = status
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { phone: { contains: search, mode: 'insensitive' } } },
        { whatsappName: { contains: search, mode: 'insensitive' } },
        { whatsappPhone: { contains: search, mode: 'insensitive' } },
        { guestName: { contains: search, mode: 'insensitive' } },
        { guestPhone: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { name: true, phone: true } },
          items: true,
          tickets: { select: { id: true, ticketNumber: true, status: true } },
        },
      }),
      prisma.order.count({ where }),
    ])

    return ok({ orders, total, pages: Math.ceil(total / limit) })
  } catch (e) {
    return serverError(e)
  }
}

// POST /api/admin/orders — manual fulfill, re-check, cancel, or resend tickets
// Body: { orderId, action: 'fulfill' | 'check' | 'cancel' | 'resend', channel?, contact? }
export async function POST(req: Request) {
  try {
    const session = await requireCapability('tickets').catch(() => null)
    if (!session) return forbidden()

    const { orderId, action, channel, contact } = await req.json()
    if (!orderId || !action) return error('orderId and action required')

    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order) return error('Order not found', 404)

    if (action === 'fulfill') {
      // Manually fulfill — used when webhook failed but user did pay
      await fulfillOrder(orderId, order.paymentMethod ?? 'manual', order.paymentRef ?? undefined)
      const [updated, ticketCount] = await Promise.all([
        prisma.order.findUnique({ where: { id: orderId }, select: { status: true } }),
        prisma.ticket.count({ where: { orderId } }),
      ])
      if (updated?.status !== 'paid' || ticketCount === 0) {
        return error(
          `Fulfillment did not complete — order status is '${updated?.status}' with ${ticketCount} ticket(s). Check server logs for details.`
        )
      }
      return ok({ message: 'Order fulfilled — tickets generated' })
    }

    if (action === 'check') {
      // Re-poll Paynow for latest status
      if (!order.paymentRef) return error('No poll URL on record')
      const txStatus = await pollPaynowTransaction(order.paymentRef)
      if (txStatus === 'paid' && order.status !== 'paid') {
        await fulfillOrder(orderId, order.paymentMethod ?? 'paynow', order.paymentRef)
        return ok({ txStatus, message: 'Payment confirmed — tickets generated' })
      }
      return ok({ txStatus, message: `Paynow status: ${txStatus}` })
    }

    if (action === 'cancel') {
      await prisma.order.update({ where: { id: orderId }, data: { status: 'failed' } })
      return ok({ message: 'Order marked as failed' })
    }

    if (action === 'resend') {
      // Manual (re)delivery — used when the automatic fire-and-forget send after
      // fulfillment failed or was never triggered (network glitch, missing/incorrect
      // contact info at checkout, WhatsApp/email misconfiguration, etc).
      if (channel !== 'whatsapp' && channel !== 'email') return error("channel must be 'whatsapp' or 'email'")
      if (order.status !== 'paid') return error('Order is not paid — nothing to send')

      const ticketCount = await prisma.ticket.count({ where: { orderId } })
      if (ticketCount === 0) return error('Order has no tickets yet — fulfill it first')

      const contactInput = typeof contact === 'string' ? contact.trim() : ''

      if (channel === 'whatsapp') {
        if (!env.META_WHATSAPP_TOKEN || !env.META_WHATSAPP_PHONE_NUMBER_ID) {
          return error('WhatsApp delivery is not configured on this server')
        }
        let phone = order.whatsappPhone
        if (contactInput) {
          const normalized = normalizeWhatsAppPhone(contactInput)
          if (!normalized) return error('That does not look like a valid phone number')
          await prisma.order.update({ where: { id: orderId }, data: { whatsappPhone: normalized } })
          phone = normalized
        }
        if (!phone) return error('No WhatsApp number on file for this order — enter one to send')

        try {
          await sendOrderTicketsWhatsApp(orderId)
        } catch (e) {
          return error(`WhatsApp send failed: ${e instanceof Error ? e.message : 'unknown error'}`)
        }
        return ok({ message: `Tickets sent via WhatsApp to ${phone}` })
      }

      // channel === 'email'
      if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
        return error('Email delivery is not configured on this server')
      }
      let emailAddr = order.email
      if (contactInput) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactInput)) return error('That does not look like a valid email address')
        await prisma.order.update({ where: { id: orderId }, data: { email: contactInput } })
        emailAddr = contactInput
      }
      if (!emailAddr) return error('No email address on file for this order — enter one to send')

      try {
        await sendOrderConfirmationEmail(orderId)
      } catch (e) {
        return error(`Email send failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
      return ok({ message: `Tickets emailed to ${emailAddr}` })
    }

    return error('Unknown action')
  } catch (e) {
    return serverError(e)
  }
}
