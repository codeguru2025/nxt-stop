import { requireCapability } from '@/lib/auth'
import { error, forbidden, serverError } from '@/lib/api'

// Uploads are served from this host without CORS headers, so the admin page can't
// read them into a canvas or PDF directly. This passes them through our own origin.
const UPLOADS_HOST = 'nxtstop-uploads.lon1.cdn.digitaloceanspaces.com'

// GET /api/admin/upload-image?url=<uploads URL> — used when building the print shop
// ticket file (event poster and logo).
export async function GET(req: Request) {
  try {
    const session = await requireCapability('tickets').catch(() => null)
    if (!session) return forbidden()

    const raw = new URL(req.url).searchParams.get('url') ?? ''
    let url: URL
    try { url = new URL(raw) } catch { return error('A valid url is required') }
    if (url.protocol !== 'https:' || url.hostname !== UPLOADS_HOST) return error('Only uploaded images can be fetched')

    const res = await fetch(url)
    if (!res.ok) return error('Image not found', 404)
    const type = res.headers.get('content-type') ?? ''
    if (!type.startsWith('image/')) return error('Not an image')
    return new Response(await res.arrayBuffer(), {
      headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=3600' },
    })
  } catch (err) {
    return serverError(err)
  }
}
