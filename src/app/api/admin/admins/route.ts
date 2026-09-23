import { prisma } from '@/lib/db'
import { requireCapability, isAdminCapability } from '@/lib/auth'
import { ok, error, forbidden, serverError } from '@/lib/api'
import { writeAuditLog } from '@/lib/auditLog'
import bcrypt from 'bcryptjs'

// GET /api/admin/admins — list all admin accounts
export async function GET() {
  try {
    const session = await requireCapability('admins').catch(() => null)
    if (!session) return forbidden()

    const admins = await prisma.user.findMany({
      where: { role: 'admin' },
      select: { id: true, name: true, phone: true, email: true, capabilities: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })

    return ok(admins)
  } catch (e) {
    return serverError(e)
  }
}

// POST /api/admin/admins — create a new admin account
export async function POST(req: Request) {
  try {
    const session = await requireCapability('admins').catch(() => null)
    if (!session) return forbidden()

    const { name, phone, password, email, capabilities } = await req.json()

    if (!name || !phone || !password) {
      return error('Name, phone number, and password are required')
    }
    if (password.length < 8) {
      return error('Password must be at least 8 characters')
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return error('Invalid email address')
    }
    if (capabilities !== undefined) {
      if (!Array.isArray(capabilities) || !capabilities.every(isAdminCapability)) {
        return error('Invalid capabilities')
      }
    }

    const existing = await prisma.user.findUnique({ where: { phone: phone.trim() } })
    if (existing) return error('Phone number already registered')

    const passwordHash = await bcrypt.hash(password, 10)

    const admin = await prisma.user.create({
      data: {
        name,
        phone: phone.trim(),
        passwordHash,
        role: 'admin',
        email: email?.trim() || null,
        capabilities: capabilities ?? [],
      },
      select: { id: true, name: true, phone: true, email: true, capabilities: true, createdAt: true },
    })

    writeAuditLog({
      actorId: session.id,
      actorRole: session.role,
      action: 'admin.create',
      entityType: 'User',
      entityId: admin.id,
      after: { name: admin.name, phone: admin.phone, capabilities: admin.capabilities },
      req,
    })

    return ok(admin, 201)
  } catch (e) {
    return serverError(e)
  }
}
