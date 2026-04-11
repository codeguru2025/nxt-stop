import QRCode from 'qrcode'
import { redis } from './redis'

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
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `NXT-${timestamp}-${random}`
}

export function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `ORD-${timestamp}-${random}`
}
