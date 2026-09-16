import { Resend } from 'resend'
import { prisma } from './db'
import { env } from './env'
import { createTicketAttachmentPng } from './ticketAttachment'
import type { DailyReport } from './reportData'

let client: Resend | null | undefined

function getClient(): Resend | null {
  if (client !== undefined) return client
  const apiKey = env.RESEND_API_KEY
  client = apiKey ? new Resend(apiKey) : null
  return client
}

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export async function sendOrderConfirmationEmail(orderId: string): Promise<void> {
  const resend = getClient()
  const from = env.EMAIL_FROM
  if (!resend || !from) return // email not configured — degrade silently, like WhatsApp

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
  if (!order.email) return

  const holderName = order.recipientName || order.whatsappName || order.user.name
  const eventName = order.tickets[0].event.name

  const attachments = await Promise.all(
    order.tickets.map(async (ticket) => {
      const png = await createTicketAttachmentPng({
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
      return { filename: `${ticket.ticketNumber}.png`, content: png }
    })
  )

  const ticketRows = order.tickets
    .map((t) => `<li>${esc(t.ticketType.name)} — ${esc(t.ticketNumber)}</li>`)
    .join('')

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <h2>Payment confirmed 🎉</h2>
      <p>Hi ${esc(holderName)}, your tickets for <strong>${esc(eventName)}</strong> are attached to this email.</p>
      <ul>${ticketRows}</ul>
      <p style="color:#666; font-size: 13px;">Total paid: $${Number(order.total).toFixed(2)}</p>
      <p style="color:#666; font-size: 13px;">Order #${esc(order.orderNumber)}</p>
      <p style="color:#999; font-size: 12px;">Present the QR code in each attached ticket at the gate.</p>
    </div>`

  await resend.emails.send({
    from,
    to: order.email,
    subject: `Your ticket${order.tickets.length > 1 ? 's' : ''} for ${eventName}`,
    html,
    attachments,
  })

  await prisma.order.update({ where: { id: order.id }, data: { emailSentAt: new Date() } })
}

export async function sendAdminDigestEmail(report: DailyReport): Promise<void> {
  const resend = getClient()
  const from = env.EMAIL_FROM
  if (!resend || !from) return

  // Recipients are every admin account with an email on file, plus any extra
  // addresses in ADMIN_DIGEST_EMAILS (e.g. stakeholders without a login).
  const admins = await prisma.user.findMany({
    where: { role: 'admin', email: { not: null } },
    select: { email: true },
  })
  const extra = (env.ADMIN_DIGEST_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const recipients = Array.from(new Set([...admins.map((a) => a.email as string), ...extra]))
  if (recipients.length === 0) {
    console.warn('[digest] no admin has an email on file and ADMIN_DIGEST_EMAILS is unset — nothing to send')
    return
  }

  const row = (label: string, value: string | number) =>
    `<tr><td style="padding:4px 12px 4px 0; color:#666;">${esc(label)}</td><td style="padding:4px 0; font-weight:600;">${value}</td></tr>`

  const eventRows = report.perEvent
    .map(
      (e) =>
        `<tr><td style="padding:4px 12px 4px 0;">${esc(e.name)}</td><td style="padding:4px 12px;">${e.ticketsSold} sold</td><td style="padding:4px 12px;">$${e.revenue.toFixed(2)}</td><td style="padding:4px 0;">${e.attendance} in</td></tr>`
    )
    .join('')

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
      <h2>NXT STOP — Daily Report</h2>
      <p style="color:#666; font-size: 13px;">${report.windowStart.toDateString()} → ${report.windowEnd.toDateString()}</p>
      <table>
        ${row('Orders paid', report.ordersPaid)}
        ${row('Orders failed', report.ordersFailed)}
        ${row('Tickets sold', report.ticketsSold)}
        ${row('Ticket revenue', `$${report.ticketRevenue.toFixed(2)}`)}
        ${row('Merch sold', `${report.merchSold} ($${report.merchRevenue.toFixed(2)})`)}
        ${row('Liquor/drinks sold', `${report.liquorSold} ($${report.liquorRevenue.toFixed(2)})`)}
        ${report.otherProductSold > 0 ? row('Other product sales', `${report.otherProductSold} ($${report.otherProductRevenue.toFixed(2)})`) : ''}
        ${row('Attendance (valid scans)', report.attendance)}
        ${row('Scan issues — invalid', report.scanAnomalies.invalid)}
        ${row('Scan issues — already used', report.scanAnomalies.alreadyUsed)}
        ${row('Scan issues — early scan', report.scanAnomalies.earlyScan)}
      </table>
      ${
        report.perEvent.length
          ? `<h3 style="margin-top:24px;">By event</h3>
             <table style="width:100%; border-collapse:collapse;">
               <thead><tr style="text-align:left; color:#666; font-size:12px;"><th>Event</th><th>Tickets</th><th>Revenue</th><th>Attendance</th></tr></thead>
               <tbody>${eventRows}</tbody>
             </table>`
          : ''
      }
    </div>`

  await resend.emails.send({
    from,
    to: recipients,
    subject: `NXT STOP daily report — ${report.windowEnd.toDateString()}`,
    html,
  })
}
