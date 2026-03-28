import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, forbidden, serverError } from '@/lib/api'
import { deleteFile } from '@/lib/storage'

export async function PATCH(
  req: Request,
  ctx: RouteContext<'/api/admin/gallery/[id]'>
) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()
    const { id } = await ctx.params

    const { caption, order, active } = await req.json()
    const photo = await prisma.galleryPhoto.update({
      where: { id },
      data: {
        ...(caption !== undefined && { caption }),
        ...(order !== undefined && { order }),
        ...(active !== undefined && { active }),
      },
    })
    return ok(photo)
  } catch (e) {
    return serverError(e)
  }
}

export async function DELETE(
  _req: Request,
  ctx: RouteContext<'/api/admin/gallery/[id]'>
) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()
    const { id } = await ctx.params

    const photo = await prisma.galleryPhoto.findUnique({ where: { id } })
    if (!photo) return Response.json({ error: 'Not found' }, { status: 404 })

    const key = photo.url.split(`/${process.env.DO_SPACES_BUCKET!}/`)[1]
    if (key) await deleteFile(key).catch(() => {})

    await prisma.galleryPhoto.delete({ where: { id } })
    return ok({ deleted: true })
  } catch (e) {
    return serverError(e)
  }
}
