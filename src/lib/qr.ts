import QRCode from 'qrcode'
import crypto from 'crypto'
import { redis } from './redis'
import { uploadFile } from './storage'

const QR_TTL = 60 * 60 * 24 * 30 // 30 days — QR codes are immutable once created

export async function generateQRDataURL(data: string): Promise<string> {
  // Check Redis cache first — QR data URLs are deterministic and never change
  if (redis) {
    try {
      const cached = await redis.get(`qr:${data}`)
      if (cached) return cached
    } catch {
      // Redis unavailable — fall through to generation
    }
  }

  const dataUrl = await QRCode.toDataURL(data, {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'H',
  })

  // Cache asynchronously — don't block the response
  if (redis) {
    redis.set(`qr:${data}`, dataUrl, 'EX', QR_TTL).catch((err: Error) => {
      console.warn('[qr] Redis cache write failed:', err.message)
    })
  }

  return dataUrl
}

export async function generateQRSVG(data: string): Promise<string> {
  return QRCode.toString(data, {
    type: 'svg',
    width: 200,
    margin: 1,
    errorCorrectionLevel: 'H',
  })
}

export function generateTicketNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = crypto.randomBytes(4).toString('hex').toUpperCase()
  return `NXT-${timestamp}-${random}`
}

export function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = crypto.randomBytes(4).toString('hex').toUpperCase()
  return `ORD-${timestamp}-${random}`
}

// Generates a QR code PNG pointing to the event's public ticket-purchase page,
// uploads it to DO Spaces, and returns the CDN URL.
export async function generateEventQrCode(eventId: string, slug: string): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const ticketUrl = `${appUrl}/events/${slug}`

  const buffer = await QRCode.toBuffer(ticketUrl, {
    type: 'png',
    width: 512,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
    errorCorrectionLevel: 'H',
  })

  return uploadFile(Buffer.from(buffer), `qr-${eventId}.png`, 'events', 'image/png')
}
