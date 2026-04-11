import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, forbidden, serverError } from '@/lib/api'
import { uploadFile, deleteFile } from '@/lib/storage'

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()
    const { id } = await ctx.params

    const media = await prisma.eventMedia.findMany({
      where: { eventId: id },
      orderBy: { order: 'asc' },
    })
    return ok(media)
  } catch (e) {
    return serverError(e)
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()
    const { id } = await ctx.params

    const event = await prisma.event.findUnique({ where: { id }, select: { id: true } })
    if (!event) return Response.json({ error: 'Event not found' }, { status: 404 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const youtubeUrl = formData.get('youtubeUrl') as string | null
    const caption = formData.get('caption') as string | null
    const type = (formData.get('type') as string) ?? 'teaser'

    if (!file) return Response.json({ error: 'file required' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.split('.').pop() ?? 'bin'
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const folder = type === 'teaser' ? 'videos' : 'gallery'
    const url = await uploadFile(buffer, filename, folder, file.type)

    const count = await prisma.eventMedia.count({ where: { eventId: id } })
    const media = await prisma.eventMedia.create({
      data: { eventId: id, type, url, youtubeUrl: youtubeUrl || null, caption: caption || null, order: count },
    })

    return ok(media, 201)
  } catch (e) {
    return serverError(e)
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()

    const { id: eventId } = await ctx.params
    const { mediaId } = await req.json()
    const media = await prisma.eventMedia.findFirst({ where: { id: mediaId, eventId } })
    if (!media) return Response.json({ error: 'Not found' }, { status: 404 })

    // Extract S3 key from the CDN URL (pathname without leading slash)
    const key = new URL(media.url).pathname.replace(/^\//, '')
    if (key) await deleteFile(key).catch(() => {})

    await prisma.eventMedia.delete({ where: { id: mediaId } })
    return ok({ deleted: true })
  } catch (e) {
    return serverError(e)
  }
}
