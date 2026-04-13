import { prisma } from './db'
import { env } from './env'
import { createTicketAttachmentPng } from './ticketAttachment'
import { toWhatsAppRecipient } from './phone'

type GraphError = {
  error?: {
    message?: string
  }
}

function baseUrl(phoneNumberId: string): string {
  return `https://graph.facebook.com/v22.0/${phoneNumberId}`
}

async function uploadTicketMedia(
  phoneNumberId: string,
  token: string,
  content: Buffer,
  filename: string
): Promise<string> {
  const form = new FormData()
  form.append('messaging_product', 'whatsapp')
  form.append('type', 'image/png')
  form.append('file', new Blob([new Uint8Array(content)], { type: 'image/png' }), filename)

  const res = await fetch(`${baseUrl(phoneNumberId)}/media`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  })

  const data = (await res.json()) as { id?: string } & GraphError
  if (!res.ok || !data.id) {
    throw new Error(data.error?.message ?? 'Failed to upload WhatsApp media')
  }
  return data.id
}

async function sendDocumentMessage(
  phoneNumberId: string,
  token: string,
  to: string,
  mediaId: string,
  filename: string,
  caption: string
) {
  const res = await fetch(`${baseUrl(phoneNumberId)}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'document',
      document: {
        id: mediaId,
        filename,
        caption,
      },
    }),
  })

  const data = (await res.json()) as GraphError
  if (!res.ok) {
    throw new Error(data.error?.message ?? 'Failed to send WhatsApp document')
  }
}

async function sendTemplateDocumentMessage(
  phoneNumberId: string,
  token: string,
  to: string,
  mediaId: string,
  filename: string,
  templateName: string,
  templateLang: string
) {
  const res = await fetch(`${baseUrl(phoneNumberId)}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: templateLang },
        components: [
          {
            type: 'header',
            parameters: [
              {
                type: 'document',
                document: { id: mediaId, filename },
              },
            ],
          },
        ],
      },
    }),
  })

  const data = (await res.json()) as GraphError
  if (!res.ok) {
    throw new Error(data.error?.message ?? 'Failed to send WhatsApp template')
  }
}

export async function sendOrderTicketsWhatsApp(orderId: string): Promise<void> {
  const token = env.META_WHATSAPP_TOKEN
  const phoneNumberId = env.META_WHATSAPP_PHONE_NUMBER_ID
  const templateName = env.WHATSAPP_TEMPLATE_NAME
  const templateLang = env.WHATSAPP_TEMPLATE_LANG
  if (!token || !phoneNumberId) return

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { name: true } },
      tickets: {
        include: {
          event: { select: { name: true, venue: true, address: true, date: true, endDate: true } },
          ticketType: { select: { name: true, color: true, price: true } },
        },
      },
    },
  })
  if (!order || order.status !== 'paid' || order.tickets.length === 0) return
  if (!order.whatsappPhone) return

  const recipient = toWhatsAppRecipient(order.whatsappPhone)
  const holderName = order.recipientName || order.whatsappName || order.user.name

  for (const ticket of order.tickets) {
    const attachment = await createTicketAttachmentPng({
      ticketNumber: ticket.ticketNumber,
      status: ticket.status,
      eventName: ticket.event.name,
      eventVenue: ticket.event.venue,
      eventAddress: ticket.event.address,
      eventDate: ticket.event.date,
      eventEndDate: ticket.event.endDate,
      ticketTypeName: ticket.ticketType.name,
      ticketTypeColor: ticket.ticketType.color,
      ticketPrice: Number(ticket.ticketType.price),
      holderName,
      qrCode: ticket.qrCode,
    })
    const filename = `${ticket.ticketNumber}.png`
    const mediaId = await uploadTicketMedia(phoneNumberId, token, attachment, filename)
    if (templateName) {
      await sendTemplateDocumentMessage(
        phoneNumberId,
        token,
        recipient,
        mediaId,
        filename,
        templateName,
        templateLang
      )
    } else {
      const caption = `Your NXT STOP ticket for ${ticket.event.name}`
      await sendDocumentMessage(phoneNumberId, token, recipient, mediaId, filename, caption)
    }
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { whatsappSentAt: new Date() },
  })
}
