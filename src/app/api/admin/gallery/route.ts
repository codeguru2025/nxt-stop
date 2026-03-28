import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, forbidden, serverError } from '@/lib/api'
import { uploadFile, deleteFile } from '@/lib/storage'

export async function GET() {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()

    const photos = await prisma.galleryPhoto.findMany({ orderBy: { order: 'asc' } })
    return ok(photos)
  } catch (e) {
    return serverError(e)
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const caption = formData.get('caption') as string | null

    if (!file) return Response.json({ error: 'file required' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.split('.').pop() ?? 'bin'
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const url = await uploadFile(buffer, filename, 'gallery', file.type)

    const count = await prisma.galleryPhoto.count()
    const photo = await prisma.galleryPhoto.create({
      data: { url, caption: caption || null, order: count },
    })

    return ok(photo, 201)
  } catch (e) {
    return serverError(e)
  }
}
