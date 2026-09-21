import sharp from 'sharp'
import { jsPDF } from 'jspdf'
import { generateQRDataURL } from './qr'
import { EVENT_TIME_ZONE } from './utils'

const LOGO_URL = 'https://nxtstop-uploads.lon1.cdn.digitaloceanspaces.com/nxt-stop%20logo%20png.png'

type TicketAttachmentInput = {
  ticketNumber: string
  status: string
  eventName: string
  eventVenue: string
  eventAddress?: string | null
  eventDate: Date
  eventEndDate?: Date | null
  eventPosterImage?: string | null
  ticketTypeName: string
  ticketTypeColor: string
  ticketPrice: number
  holderName: string
  qrCode: string
}

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function statusLabel(status: string): string {
  return (status || 'valid').toUpperCase()
}

// Mirrors the status pill colors used by the in-app ticket card (TicketsClient.tsx).
function statusColors(status: string): { bg: string; fg: string } {
  if (status === 'valid') return { bg: '#dcfce7', fg: '#16a34a' }
  if (status === 'used') return { bg: '#f3f4f6', fg: '#6b7280' }
  return { bg: '#fee2e2', fg: '#dc2626' }
}

async function fetchDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    const contentType = res.headers.get('content-type') ?? 'image/png'
    return `data:${contentType};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

type TicketAssets = {
  posterDataUri: string | null
  logoDataUri: string | null
  qrDataUrl: string
  when: string
  endTime: string
  venue: string
  safeColor: string
  status: { bg: string; fg: string }
}

async function prepareAssets(input: TicketAttachmentInput): Promise<TicketAssets> {
  const [posterDataUri, logoDataUri, qrDataUrl] = await Promise.all([
    fetchDataUri(input.eventPosterImage),
    fetchDataUri(LOGO_URL),
    generateQRDataURL(input.qrCode),
  ])

  // Event times are wall-clock in the venue's timezone (CAT, fixed UTC+2) — must format
  // in that zone explicitly, or a server running in UTC shifts every ticket by 2 hours.
  const when = new Intl.DateTimeFormat('en-US', {
    timeZone: EVENT_TIME_ZONE,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(input.eventDate)
  const endTime = input.eventEndDate
    ? new Intl.DateTimeFormat('en-US', { timeZone: EVENT_TIME_ZONE, hour: 'numeric', minute: '2-digit' }).format(input.eventEndDate)
    : ''
  const venue = `${input.eventVenue}${input.eventAddress ? `, ${input.eventAddress}` : ''}`
  const safeColor = /^#[0-9a-fA-F]{6}$/.test(input.ticketTypeColor) ? input.ticketTypeColor : '#7C3AED'

  return { posterDataUri, logoDataUri, qrDataUrl, when, endTime, venue, safeColor, status: statusColors(input.status) }
}

const W = 1000
const BANNER_H = 300
const PAD = 70

// Renders the same "physical ticket" card shown in the app (TicketsClient.tsx /
// the print view) — white card, event poster banner, logo, QR — so a ticket
// downloaded or sent over WhatsApp/email looks identical to what a user sees
// when they open it in their dashboard.
export async function createTicketAttachmentPng(input: TicketAttachmentInput): Promise<Buffer> {
  const a = await prepareAssets(input)

  const banner = a.posterDataUri
    ? `<clipPath id="bannerClip"><rect x="0" y="0" width="${W}" height="${BANNER_H}" /></clipPath>
       <image href="${a.posterDataUri}" x="0" y="0" width="${W}" height="${BANNER_H}" preserveAspectRatio="xMidYMid slice" clip-path="url(#bannerClip)" />`
    : `<rect x="0" y="0" width="${W}" height="${BANNER_H}" fill="url(#bannerGrad)" />
       <text x="${W / 2}" y="${BANNER_H / 2 + 20}" fill="rgba(255,255,255,0.15)" font-family="Arial, sans-serif" font-size="64" font-weight="900" text-anchor="middle" letter-spacing="4">NXT STOP</text>`

  // Info column sits to the right of the QR box; laid out top-down with a
  // running cursor so the "ticket for" row can be present or absent.
  const QR_X = PAD
  const QR_Y = BANNER_H + 450
  const QR_SIZE = 320
  const INFO_X = QR_X + QR_SIZE + 60

  let iy = QR_Y + 40
  let holderBlock = ''
  if (input.holderName) {
    holderBlock = `<text x="${INFO_X}" y="${iy}" fill="#9ca3af" font-family="Arial, sans-serif" font-size="18" letter-spacing="1">TICKET FOR</text>
       <text x="${INFO_X}" y="${iy + 34}" fill="#111827" font-family="Arial, sans-serif" font-size="28" font-weight="700">${esc(input.holderName)}</text>`
    iy += 78
  }
  const ticketNoLabelY = iy
  const ticketNoValueY = iy + 30
  iy += 74
  const priceLabelY = iy
  const priceValueY = iy + 44
  iy += 90
  const statusY = iy

  // Footer must clear whichever is taller — the QR box or the info column.
  const contentBottom = Math.max(QR_Y + QR_SIZE, statusY + 70)
  const FOOTER_H = 110
  const FOOTER_Y = contentBottom + 50
  const H = FOOTER_Y + FOOTER_H

  const svg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bannerGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7c3aed" />
      <stop offset="50%" stop-color="#9333ea" />
      <stop offset="100%" stop-color="#db2777" />
    </linearGradient>
    <linearGradient id="footerGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#7c3aed" />
      <stop offset="50%" stop-color="#9333ea" />
      <stop offset="100%" stop-color="#db2777" />
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" rx="0" fill="#ffffff" />
  ${banner}

  ${a.logoDataUri ? `<image href="${a.logoDataUri}" x="${PAD}" y="${BANNER_H + 40}" width="220" height="64" preserveAspectRatio="xMinYMid meet" />` : ''}
  <text x="${PAD + 250}" y="${BANNER_H + 62}" fill="#9ca3af" font-family="Arial, sans-serif" font-size="18" letter-spacing="2">NXT STOP</text>
  <text x="${PAD + 250}" y="${BANNER_H + 102}" fill="#111827" font-family="Arial, sans-serif" font-size="42" font-weight="900">${esc(input.eventName)}</text>
  <rect x="${PAD + 250}" y="${BANNER_H + 122}" width="${Math.max(140, input.ticketTypeName.length * 15 + 50)}" height="38" rx="19" fill="${a.safeColor}" />
  <text x="${PAD + 272}" y="${BANNER_H + 148}" fill="#ffffff" font-family="Arial, sans-serif" font-size="20" font-weight="700">${esc(input.ticketTypeName)}</text>

  <text x="${PAD}" y="${BANNER_H + 262}" fill="#9ca3af" font-family="Arial, sans-serif" font-size="18" letter-spacing="1">DATE &amp; TIME</text>
  <text x="${PAD}" y="${BANNER_H + 296}" fill="#4b5563" font-family="Arial, sans-serif" font-size="26">${esc(a.when)}${a.endTime ? ` – ${esc(a.endTime)}` : ''}</text>
  <text x="${PAD}" y="${BANNER_H + 344}" fill="#9ca3af" font-family="Arial, sans-serif" font-size="18" letter-spacing="1">VENUE</text>
  <text x="${PAD}" y="${BANNER_H + 378}" fill="#4b5563" font-family="Arial, sans-serif" font-size="26">${esc(a.venue)}</text>

  <line x1="${PAD}" y1="${BANNER_H + 420}" x2="${W - PAD}" y2="${BANNER_H + 420}" stroke="#e5e7eb" stroke-width="3" stroke-dasharray="10,10" />

  <rect x="${QR_X}" y="${QR_Y}" width="${QR_SIZE}" height="${QR_SIZE}" rx="16" fill="#ffffff" stroke="#e5e7eb" stroke-width="2" />
  <image href="${a.qrDataUrl}" x="${QR_X + 12}" y="${QR_Y + 12}" width="${QR_SIZE - 24}" height="${QR_SIZE - 24}" preserveAspectRatio="xMidYMid meet" />

  ${holderBlock}
  <text x="${INFO_X}" y="${ticketNoLabelY}" fill="#9ca3af" font-family="Arial, sans-serif" font-size="18" letter-spacing="1">TICKET NO</text>
  <text x="${INFO_X}" y="${ticketNoValueY}" fill="#6b7280" font-family="Courier New, monospace" font-size="20">${esc(input.ticketNumber)}</text>
  <text x="${INFO_X}" y="${priceLabelY}" fill="#9ca3af" font-family="Arial, sans-serif" font-size="18" letter-spacing="1">PRICE</text>
  <text x="${INFO_X}" y="${priceValueY}" fill="#7c3aed" font-family="Arial, sans-serif" font-size="46" font-weight="900">$${input.ticketPrice.toFixed(2)}</text>
  <rect x="${INFO_X}" y="${statusY}" width="${Math.max(110, statusLabel(input.status).length * 14 + 40)}" height="36" rx="18" fill="${a.status.bg}" />
  <text x="${INFO_X + 20}" y="${statusY + 25}" fill="${a.status.fg}" font-family="Arial, sans-serif" font-size="18" font-weight="700">${statusLabel(input.status)}</text>

  <rect x="0" y="${FOOTER_Y}" width="${W}" height="${FOOTER_H}" fill="url(#footerGrad)" />
  <text x="${PAD}" y="${FOOTER_Y + 55}" fill="#ffffff" font-family="Arial, sans-serif" font-size="26" font-weight="900">NXT STOP</text>
  <text x="${W - PAD}" y="${FOOTER_Y + 48}" fill="#ffffff" font-family="Arial, sans-serif" font-size="18" text-anchor="end">Present this QR code at the gate</text>
  <text x="${W - PAD}" y="${FOOTER_Y + 72}" fill="rgba(255,255,255,0.75)" font-family="Arial, sans-serif" font-size="16" text-anchor="end">nxtstop.com</text>
</svg>`

  return sharp(Buffer.from(svg)).png({ quality: 95 }).toBuffer()
}

// PDF version of the same card — used when an admin (or the resend flow) needs
// a printable/emailable file rather than an image.
export async function createTicketAttachmentPdf(input: TicketAttachmentInput): Promise<Buffer> {
  const a = await prepareAssets(input)

  const pageW = 100
  const pageH = 170
  const doc = new jsPDF({ unit: 'mm', format: [pageW, pageH] })
  let y = 0

  if (a.posterDataUri) {
    try {
      doc.addImage(a.posterDataUri, 0, 0, pageW, 55, undefined, 'FAST')
      y = 63
    } catch {
      y = 8
    }
  } else {
    doc.setFillColor(124, 58, 237)
    doc.rect(0, 0, pageW, 8, 'F')
    y = 16
  }

  if (a.logoDataUri) {
    try {
      const props = doc.getImageProperties(a.logoDataUri)
      const logoH = 10
      const logoW = Math.min((logoH * props.width) / props.height, 30)
      doc.addImage(a.logoDataUri, 8, y, logoW, logoH, undefined, 'FAST')
    } catch {}
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(150, 150, 150)
  doc.text('NXT STOP', pageW - 8, y + 4, { align: 'right' })

  y += 16
  doc.setFontSize(15)
  doc.setTextColor(20, 20, 20)
  doc.text(input.eventName, 8, y, { maxWidth: pageW - 16 })

  y += 8
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(90, 90, 90)
  doc.text(`${a.when}${a.endTime ? ` – ${a.endTime}` : ''}`, 8, y, { maxWidth: pageW - 16 })
  y += 5
  doc.text(a.venue, 8, y, { maxWidth: pageW - 16 })

  y += 8
  doc.setDrawColor(220, 220, 220)
  doc.line(8, y, pageW - 8, y)
  y += 8

  const qrSize = 36
  doc.addImage(a.qrDataUrl, 'PNG', 8, y, qrSize, qrSize)

  const infoX = 8 + qrSize + 8
  let infoY = y + 5
  if (input.holderName) {
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text('TICKET FOR', infoX, infoY)
    infoY += 5
    doc.setFontSize(10)
    doc.setTextColor(20, 20, 20)
    doc.setFont('helvetica', 'bold')
    doc.text(input.holderName, infoX, infoY, { maxWidth: pageW - infoX - 8 })
    infoY += 7
  }
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.setFont('helvetica', 'normal')
  doc.text('TICKET NO', infoX, infoY)
  infoY += 4.5
  doc.setFontSize(8)
  doc.setTextColor(90, 90, 90)
  doc.text(input.ticketNumber, infoX, infoY, { maxWidth: pageW - infoX - 8 })
  infoY += 7
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text('PRICE', infoX, infoY)
  infoY += 5.5
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(124, 58, 237)
  doc.text(`$${input.ticketPrice.toFixed(2)}`, infoX, infoY)
  infoY += 6
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(a.status.fg)
  doc.text(statusLabel(input.status), infoX, infoY)

  y = Math.max(y + qrSize, infoY) + 10
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(140, 140, 140)
  doc.text('Present this QR code at the gate · nxtstop.com', pageW / 2, y, { align: 'center' })

  return Buffer.from(doc.output('arraybuffer'))
}
