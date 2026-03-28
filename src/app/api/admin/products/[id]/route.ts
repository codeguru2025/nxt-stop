import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, error, forbidden, serverError } from '@/lib/api'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()

    const { id } = await params
    const body = await req.json()

    const allowed = ['name','description','price','stock','sold','category','image',
                     'lowStockAt','active','merchType','size','color']
    const data: Record<string, any> = {}
    for (const key of allowed) {
      if (key in body) data[key] = body[key]
    }

    const product = await prisma.product.update({ where: { id }, data })
    return ok(product)
  } catch (e) {
    return serverError(e)
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()

    const { id } = await params
    await prisma.product.update({ where: { id }, data: { active: false } })
    return ok({ deleted: true })
  } catch (e) {
    return serverError(e)
  }
}
