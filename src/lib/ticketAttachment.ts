import sharp from 'sharp'
import { generateQRSVG } from './qr'

type TicketAttachmentInput = {
  ticketNumber: string
  status: string
  eventName: string
  eventVenue: string
  eventAddress?: string | null
  eventDate: Date
  eventEndDate?: Date | null
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

export async function createTicketAttachmentPng(input: TicketAttachmentInput): Promise<Buffer> {
  const qrSvg = await generateQRSVG(input.qrCode)
  const when = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(input.eventDate)
  const endTime = input.eventEndDate
    ? new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(input.eventEndDate)
    : ''
  const venue = `${input.eventVenue}${input.eventAddress ? `, ${input.eventAddress}` : ''}`
  const safeColor = /^#[0-9a-fA-F]{6}$/.test(input.ticketTypeColor) ? input.ticketTypeColor : '#7C3AED'

  const svg = `
<svg width="1080" height="1600" viewBox="0 0 1080 1600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0A0A0A" />
      <stop offset="100%" stop-color="#18181B" />
    </linearGradient>
  </defs>
  <rect width="1080" height="1600" fill="url(#bg)" />
  <rect x="60" y="60" width="960" height="1480" rx="36" fill="#111827" stroke="#27272A" stroke-width="4" />

  <text x="120" y="165" fill="#A1A1AA" font-family="Arial, sans-serif" font-size="28">NXT STOP DIGITAL TICKET</text>
  <text x="120" y="225" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="56" font-weight="700">${esc(input.eventName)}</text>

  <rect x="120" y="260" width="300" height="52" rx="26" fill="${safeColor}" />
  <text x="145" y="295" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="26" font-weight="700">${esc(input.ticketTypeName)}</text>

  <text x="120" y="380" fill="#A1A1AA" font-family="Arial, sans-serif" font-size="26">ATTENDEE</text>
  <text x="120" y="424" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="38" font-weight="700">${esc(input.holderName)}</text>

  <text x="120" y="500" fill="#A1A1AA" font-family="Arial, sans-serif" font-size="26">DATE &amp; TIME</text>
  <text x="120" y="544" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="34">${esc(when)}${endTime ? ` - ${esc(endTime)}` : ''}</text>

  <text x="120" y="620" fill="#A1A1AA" font-family="Arial, sans-serif" font-size="26">VENUE</text>
  <text x="120" y="664" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="34">${esc(venue)}</text>

  <text x="120" y="742" fill="#A1A1AA" font-family="Arial, sans-serif" font-size="26">TICKET NO</text>
  <text x="120" y="786" fill="#FFFFFF" font-family="Courier New, monospace" font-size="30">${esc(input.ticketNumber)}</text>

  <text x="120" y="858" fill="#A1A1AA" font-family="Arial, sans-serif" font-size="26">PRICE</text>
  <text x="120" y="902" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="40" font-weight="700">$${input.ticketPrice.toFixed(2)}</text>

  <text x="120" y="976" fill="#A1A1AA" font-family="Arial, sans-serif" font-size="26">STATUS</text>
  <text x="120" y="1020" fill="#22C55E" font-family="Arial, sans-serif" font-size="36" font-weight="700">${statusLabel(input.status)}</text>

  <rect x="640" y="1110" width="300" height="300" rx="18" fill="#FFFFFF" />
  <g transform="translate(670,1140) scale(1.9)">
    ${qrSvg.replace(/<\?xml[^>]*\?>/g, '').replace(/<!DOCTYPE[^>]*>/g, '').replace(/<svg[^>]*>|<\/svg>/g, '')}
  </g>
  <text x="640" y="1455" fill="#A1A1AA" font-family="Arial, sans-serif" font-size="24">Present this QR at gate</text>
</svg>`

  return sharp(Buffer.from(svg)).png({ quality: 95 }).toBuffer()
}
