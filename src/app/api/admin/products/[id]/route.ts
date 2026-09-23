import { prisma } from '@/lib/db'
import { requireCapability } from '@/lib/auth'
import { ok, error, forbidden, serverError } from '@/lib/api'
import { holdForApproval } from '@/lib/approvals'
import { describeProductUpdate, describeProductDelete } from '@/lib/approvalDescribe'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await requireCapability('store').catch(() => null)
    if (!session) return forbidden()

    const { id } = await params
    const body = await req.json()

    const allowed = ['name','description','price','stock','category','image',
                     'lowStockAt','active','merchType','size','color','isTable','capacityPerUnit']
    const data: Record<string, any> = {}
    for (const key of allowed) {
      if (key in body) data[key] = body[key]
    }

    const held = await holdForApproval(req, session, {
      action: 'product.update', capability: 'store', route: '/api/admin/products/[id]', params: { id }, body,
      entityType: 'Product', entityId: id, describe: () => describeProductUpdate(id, body),
    })
    if (held) return held

    const product = await prisma.product.update({ where: { id }, data })
    return ok(product)
  } catch (e) {
    return serverError(e)
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const session = await requireCapability('store').catch(() => null)
    if (!session) return forbidden()

    const { id } = await params
    const held = await holdForApproval(req, session, {
      action: 'product.delete', capability: 'store', route: '/api/admin/products/[id]', params: { id },
      entityType: 'Product', entityId: id, describe: () => describeProductDelete(id),
    })
    if (held) return held

    await prisma.product.update({ where: { id }, data: { active: false } })
    return ok({ deleted: true })
  } catch (e) {
    return serverError(e)
  }
}
