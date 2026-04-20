import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, forbidden, notFound, serverError } from '@/lib/api'
import { generateEventQrCode } from '@/lib/qr'

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()
    const { id } = await ctx.params

    const event = await prisma.event.findUnique({ where: { id }, select: { id: true, slug: true } })
    if (!event) return notFound('Event')

    const qrCodeUrl = await generateEventQrCode(event.id, event.slug)
    await prisma.event.update({ where: { id }, data: { qrCodeUrl } })

    return ok({ qrCodeUrl })
  } catch (e) {
    return serverError(e)
  }
}
