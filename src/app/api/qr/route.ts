import { generateQRDataURL } from '@/lib/qr'
import { error, unauthorized, serverError } from '@/lib/api'
import { requireAuth } from '@/lib/auth'
import { checkScanLimit } from '@/lib/rateLimit'

export async function GET(req: Request) {
  try {
    const session = await requireAuth().catch(() => null)
    if (!session) return unauthorized()

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    const { limited } = await checkScanLimit(ip)
    if (limited) return error('Too many requests', 429)

    const url = new URL(req.url)
    const data = url.searchParams.get('data')
    if (!data) return error('data param required')
    if (data.length > 500) return error('data too long', 400)

    const dataUrl = await generateQRDataURL(data)
    const base64 = dataUrl.split(',')[1]
    const buffer = Buffer.from(base64, 'base64')

    return new Response(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (e) {
    return serverError(e)
  }
}
