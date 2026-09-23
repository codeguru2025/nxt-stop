import { prisma } from '@/lib/db'
import { requireCapability } from '@/lib/auth'
import { ok, error, forbidden, serverError } from '@/lib/api'
import { holdForApproval } from '@/lib/approvals'
import { describeProductCreate } from '@/lib/approvalDescribe'

export async function GET(req: Request) {
  try {
    const session = await requireCapability('store').catch(() => null)
    if (!session) return forbidden()

    const url = new URL(req.url)
    const eventId  = url.searchParams.get('eventId')
    const category = url.searchParams.get('category')

    const products = await prisma.product.findMany({
      where: {
        ...(eventId  ? { eventId }  : {}),
        ...(category ? { category } : {}),
      },
      orderBy: { sold: 'desc' },
      include: { event: { select: { name: true } } },
    })

    return ok(products)
  } catch (e) {
    return serverError(e)
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireCapability('store').catch(() => null)
    if (!session) return forbidden()

    const body = await req.json()
    const {
      eventId, name, description, price, stock, category,
      image, lowStockAt, merchType, size, color, isTable, capacityPerUnit,
    } = body

    if (!eventId || !name || price === undefined || stock === undefined) {
      return error('eventId, name, price, and stock are required')
    }

    const held = await holdForApproval(req, session, {
      action: 'product.create', capability: 'store', route: '/api/admin/products', body,
      entityType: 'Product', describe: () => describeProductCreate(body),
    })
    if (held) return held

    const product = await prisma.product.create({
      data: {
        eventId, name, description, price, stock,
        category:  category  ?? 'drink',
        image,
        lowStockAt: lowStockAt ?? 10,
        merchType:  merchType  ?? null,
        size:       size       ?? null,
        color:      color      ?? null,
        isTable: !!isTable,
        capacityPerUnit: capacityPerUnit != null ? Number(capacityPerUnit) : null,
      },
    })

    return ok(product, 201)
  } catch (e) {
    return serverError(e)
  }
}
