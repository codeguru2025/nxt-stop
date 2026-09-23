import { prisma } from '@/lib/db'
import { requireCapability } from '@/lib/auth'
import { ok, error, forbidden, serverError } from '@/lib/api'
import bcrypt from 'bcryptjs'
import { generateQRDataURL } from '@/lib/qr'
import crypto from 'crypto'
import { holdForApproval } from '@/lib/approvals'
import { describePartnerCreate, describePartnerUpdate } from '@/lib/approvalDescribe'

export async function GET() {
  try {
    const session = await requireCapability('partners').catch(() => null)
    if (!session) return forbidden()

    const partners = await prisma.partner.findMany({
      orderBy: { totalSales: 'desc' },
      include: {
        user: { select: { name: true, phone: true } },
        commissions: { select: { amount: true, status: true } },
        _count: { select: { tickets: true } },
      },
    })

    return ok(partners)
  } catch (e) {
    return serverError(e)
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireCapability('partners').catch(() => null)
    if (!session) return forbidden()

    const body = await req.json()
    const {
      name, phone, type, businessName, commissionRate, commissionPerTicket, password,
    } = body

    if (!name || !phone || !type || !password) {
      return error('name, phone, type, and password are required')
    }

    const existing = await prisma.user.findUnique({ where: { phone: phone.trim() } })
    if (existing) return error('Phone number already registered')

    const held = await holdForApproval(req, session, {
      action: 'partner.create', capability: 'partners', route: '/api/admin/partners', body,
      entityType: 'Partner', describe: () => describePartnerCreate(body),
    })
    if (held) return held

    const passwordHash = await bcrypt.hash(password, 10)
    const referralCode = crypto.randomBytes(6).toString('hex').toUpperCase()
    const qrPayload = `${process.env.NEXT_PUBLIC_APP_URL}/r/${referralCode}`
    const qrDataUrl = await generateQRDataURL(qrPayload)

    const partner = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, phone: phone.trim(), passwordHash, role: 'partner' },
      })
      return tx.partner.create({
        data: {
          userId: user.id,
          type,
          businessName,
          referralCode,
          qrCode: qrDataUrl,
          commissionRate: commissionRate ?? 10,
          commissionPerTicket: commissionPerTicket ?? 0,
        },
        include: { user: { select: { name: true, phone: true } } },
      })
    })

    return ok(partner, 201)
  } catch (e) {
    return serverError(e)
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireCapability('partners').catch(() => null)
    if (!session) return forbidden()

    const body = await req.json()
    const { partnerId, commissionRate, commissionPerTicket, active } = body
    if (!partnerId) return error('partnerId is required')

    const held = await holdForApproval(req, session, {
      action: 'partner.update', capability: 'partners', route: '/api/admin/partners', body,
      entityType: 'Partner', entityId: String(partnerId), describe: () => describePartnerUpdate(body),
    })
    if (held) return held

    const partner = await prisma.partner.update({
      where: { id: partnerId },
      data: {
        ...(commissionRate !== undefined && { commissionRate }),
        ...(commissionPerTicket !== undefined && { commissionPerTicket }),
        ...(active !== undefined && { active }),
      },
      include: { user: { select: { name: true, phone: true } } },
    })

    return ok(partner)
  } catch (e) {
    return serverError(e)
  }
}
