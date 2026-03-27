import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, forbidden, notFound, serverError } from '@/lib/api'

export async function PATCH(
  req: Request,
  ctx: RouteContext<'/api/admin/founders/[id]'>
) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()
    const { id } = await ctx.params
    const { name, role, bio, image, order, active } = await req.json()

    const founder = await prisma.founder.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(role !== undefined && { role }),
        ...(bio !== undefined && { bio }),
        ...(image !== undefined && { image }),
        ...(order !== undefined && { order }),
        ...(active !== undefined && { active }),
      },
    })

    return ok(founder)
  } catch (e) {
    return serverError(e)
  }
}

export async function DELETE(
  _req: Request,
  ctx: RouteContext<'/api/admin/founders/[id]'>
) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()
    const { id } = await ctx.params

    await prisma.founder.delete({ where: { id } })
    return ok({ deleted: true })
  } catch (e) {
    return serverError(e)
  }
}
