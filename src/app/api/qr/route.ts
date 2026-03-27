import { generateQRDataURL } from '@/lib/qr'
import { error } from '@/lib/api'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const data = url.searchParams.get('data')
  if (!data) return error('data param required')

  const dataUrl = await generateQRDataURL(data)
  // Return as PNG image
  const base64 = dataUrl.split(',')[1]
  const buffer = Buffer.from(base64, 'base64')

  return new Response(buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
