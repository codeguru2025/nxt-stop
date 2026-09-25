import { Resend } from 'resend'
import { createAuditLogPdf } from './auditLogPdf'
import { prisma } from './db'
import { env } from './env'
import { createTicketAttachmentPng } from './ticketAttachment'
import { generateQRDataURL } from './qr'
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
          event: { select: { name: true, venue: true, address: true, date: true, endDate: true, posterImage: true } },
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
        eventPosterImage: ticket.event.posterImage,
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

// Sent once, right after checkout creates a brand-new account. Carries the
// system-issued one-time password in plaintext — this is the only place it is ever
// visible outside the (already-hashed) DB column.
export async function sendWelcomeEmail(userId: string, plaintextPassword: string): Promise<void> {
  const resend = getClient()
  const from = env.EMAIL_FROM
  if (!resend || !from) return

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } })
  if (!user?.email) return

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <h2>Welcome to NXT STOP 🎉</h2>
      <p>Hi ${esc(user.name)}, your account has been created.</p>
      <p>Here's a one-time password to sign in for the first time:</p>
      <p style="font-size: 20px; font-weight: 700; letter-spacing: 2px; background:#f4f4f4; padding: 12px 16px; border-radius: 8px; display: inline-block;">${esc(plaintextPassword)}</p>
      <p style="color:#666; font-size: 13px;">This password only works once — you'll be asked to set your own password the first time you sign in.</p>
    </div>`

  await resend.emails.send({
    from,
    to: user.email,
    subject: 'Welcome to NXT STOP — your one-time password',
    html,
  })
}

// Self-service password reset link (email-verified). See /api/auth/forgot-password
// and /api/auth/reset-password.
export async function sendPasswordResetEmail(userId: string, token: string): Promise<void> {
  const resend = getClient()
  const from = env.EMAIL_FROM
  if (!resend || !from) return

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } })
  if (!user?.email) return

  const resetUrl = `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <h2>Reset your password</h2>
      <p>Hi ${esc(user.name)}, click below to set a new password. This link expires in 30 minutes and can only be used once.</p>
      <p><a href="${resetUrl}" style="display:inline-block; background:#8B5CF6; color:#fff; padding: 10px 20px; border-radius: 8px; text-decoration:none;">Reset password</a></p>
      <p style="color:#999; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
    </div>`

  await resend.emails.send({
    from,
    to: user.email,
    subject: 'NXT STOP — reset your password',
    html,
  })
}

// Fired when a referral converts into a cash reward (see fulfillOrder.ts).
export async function sendReferralRewardEarnedEmail(userId: string, amount: number): Promise<void> {
  const resend = getClient()
  const from = env.EMAIL_FROM
  if (!resend || !from) return

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } })
  if (!user?.email) return

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <h2>You just earned a referral reward 💸</h2>
      <p>Hi ${esc(user.name)}, someone made a purchase through your link — you've earned <strong>$${amount.toFixed(2)}</strong>.</p>
      <p style="color:#666; font-size: 13px;">Track your total earnings and payout status on your NXT STOP dashboard.</p>
    </div>`

  await resend.emails.send({
    from,
    to: user.email,
    subject: `You earned $${amount.toFixed(2)} from a referral`,
    html,
  })
}

// Sent when a paid order contains pre-event purchases (beverage/liquor vouchers,
// merchandise, tables) — see fulfillOrder.ts's voucher-minting loop.
export async function sendVoucherPurchaseEmail(orderId: string): Promise<void> {
  const resend = getClient()
  const from = env.EMAIL_FROM
  if (!resend || !from) return

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { name: true } },
      vouchers: { include: { product: { select: { name: true, category: true } } } },
    },
  })
  if (!order || order.status !== 'paid' || order.vouchers.length === 0) return
  if (!order.email) return

  const holderName = order.recipientName || order.whatsappName || order.user.name

  const attachments = await Promise.all(
    order.vouchers.map(async (v) => {
      const dataUrl = await generateQRDataURL(v.qrCode)
      const base64 = dataUrl.split(',')[1] ?? ''
      return { filename: `${v.code}.png`, content: Buffer.from(base64, 'base64') }
    })
  )

  const rows = order.vouchers
    .map((v) => `<li>${esc(v.product.name)} — code <strong>${esc(v.code)}</strong></li>`)
    .join('')

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <h2>Your pre-event purchase is confirmed 🎟️</h2>
      <p>Hi ${esc(holderName)}, here's what you bought — present the attached QR code (or the code itself) to redeem at the event.</p>
      <ul>${rows}</ul>
      <p style="color:#666; font-size: 13px;">Total paid: $${Number(order.total).toFixed(2)}</p>
      <p style="color:#666; font-size: 13px;">Order #${esc(order.orderNumber)}</p>
    </div>`

  await resend.emails.send({
    from,
    to: order.email,
    subject: `Your NXT STOP purchase — order #${order.orderNumber}`,
    html,
    attachments,
  })
}

/**
 * @param opts.onlyTo send just to this admin's email (an on-demand copy) instead of every
 *   admin — refused unless the address belongs to an admin account. They get the audit
 *   PDF only if that account is a platform owner, same as the daily send.
 */
export async function sendAdminDigestEmail(report: DailyReport, opts: { onlyTo?: string } = {}): Promise<void> {
  const resend = getClient()
  const from = env.EMAIL_FROM
  if (!resend || !from) return

  // Recipients are every admin account with an email on file, plus any extra
  // addresses in ADMIN_DIGEST_EMAILS (e.g. stakeholders without a login).
  const allAdmins = await prisma.user.findMany({
    where: { role: 'admin', email: { not: null } },
    select: { email: true, isPlatformOwner: true },
  })
  const onlyTo = opts.onlyTo?.trim().toLowerCase()
  const admins = onlyTo ? allAdmins.filter((a) => a.email?.toLowerCase() === onlyTo) : allAdmins
  if (onlyTo && admins.length === 0) throw new Error('That email does not belong to an admin account')
  const extra = onlyTo ? [] : (env.ADMIN_DIGEST_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
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
        ${row('Website — pages viewed', report.website.pageViews)}
        ${row('Website — different visitors', report.website.visitors)}
        ${row('Referral link clicks', report.website.referralClicks)}
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

  const subject = `NXT STOP daily report — ${report.windowEnd.toDateString()}`

  // The audit log is restricted to platform owner accounts, so only their copy of the
  // report carries it (as a branded PDF). Everyone else gets the report alone.
  const auditRecipients = new Set(admins.filter((a) => a.isPlatformOwner).map((a) => a.email as string))
  const plainRecipients = recipients.filter((r) => !auditRecipients.has(r))

  if (auditRecipients.size > 0) {
    let attachments: { filename: string; content: Buffer }[] = []
    let auditNote = ''
    try {
      const { pdf, count } = await createAuditLogPdf(report.windowStart, report.windowEnd)
      const day = report.windowEnd.toISOString().slice(0, 10)
      attachments = [{ filename: `nxt-stop-audit-log-${day}.pdf`, content: pdf }]
      auditNote = `<p style="margin-top:24px; padding:12px 16px; background:#f5f3ff; border-left:4px solid #7c3aed; font-size:13px;">
        <strong>Audit log:</strong> ${count} entr${count === 1 ? 'y' : 'ies'} in this period — full log attached as a PDF.
        This attachment is only sent to platform owner accounts.</p>`
    } catch (err) {
      console.error('[digest] audit log PDF failed — sending report without it', err)
      auditNote = '<p style="margin-top:24px; color:#b91c1c; font-size:13px;">The audit log PDF could not be generated today — view it in the admin panel.</p>'
    }
    await resend.emails.send({
      from,
      to: [...auditRecipients],
      subject,
      html: html.replace(/<\/div>\s*$/, `${auditNote}</div>`),
      attachments,
    })
  }

  if (plainRecipients.length > 0) {
    await resend.emails.send({ from, to: plainRecipients, subject, html })
  }
}
