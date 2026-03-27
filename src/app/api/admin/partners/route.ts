import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, error, forbidden, serverError } from '@/lib/api'
import bcrypt from 'bcryptjs'
import { generateQRDataURL } from '@/lib/qr'
import crypto from 'crypto'

export async function GET() {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()

    const partners = await prisma.partner.findMany({
      orderBy: { totalSales: 'desc' },
      include: {
        user: { select: { name: true, email: true, phone: true } },
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
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()

    const {
      name, email, phone, type, businessName, commissionRate, password,
    } = await req.json()

    if (!name || !email || !type || !password) {
      return error('name, email, type, and password are required')
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return error('Email already registered')

    const passwordHash = await bcrypt.hash(password, 12)
    const referralCode = crypto.randomBytes(6).toString('hex').toUpperCase()

    const user = await prisma.user.create({
      data: { name, email, phone, passwordHash, role: 'partner' },
    })

    const qrPayload = `${process.env.NEXT_PUBLIC_APP_URL}/r/${referralCode}`
    const qrDataUrl = await generateQRDataURL(qrPayload)

    const partner = await prisma.partner.create({
      data: {
        userId: user.id,
        type,
        businessName,
        referralCode,
        qrCode: qrDataUrl,
        commissionRate: commissionRate ?? 10,
      },
      include: { user: { select: { name: true, email: true } } },
    })

    return ok(partner, 201)
  } catch (e) {
    return serverError(e)
  }
}
