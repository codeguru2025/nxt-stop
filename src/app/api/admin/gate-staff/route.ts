import { prisma } from '@/lib/db'
import { requireCapability } from '@/lib/auth'
import { ok, error, forbidden, serverError } from '@/lib/api'
import bcrypt from 'bcryptjs'
import { holdForApproval } from '@/lib/approvals'
import { describeGateStaffCreate } from '@/lib/approvalDescribe'

// GET /api/admin/gate-staff — list all gate staff
export async function GET() {
  try {
    const session = await requireCapability('gate_staff').catch(() => null)
    if (!session) return forbidden()

    const staff = await prisma.user.findMany({
      where: { role: 'gate_staff' },
      select: { id: true, name: true, phone: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })

    return ok(staff)
  } catch (e) {
    return serverError(e)
  }
}

// POST /api/admin/gate-staff — create a gate staff account
export async function POST(req: Request) {
  try {
    const session = await requireCapability('gate_staff').catch(() => null)
    if (!session) return forbidden()

    const body = await req.json()
    const { name, phone, password } = body

    if (!name || !phone || !password) {
      return error('Name, phone number, and password are required')
    }
    if (password.length < 8) {
      return error('Password must be at least 8 characters')
    }

    const existing = await prisma.user.findUnique({ where: { phone: phone.trim() } })
    if (existing) return error('Phone number already registered')

    const held = await holdForApproval(req, session, {
      action: 'gate-staff.create', capability: 'gate_staff', route: '/api/admin/gate-staff', body,
      entityType: 'User', describe: () => describeGateStaffCreate(body),
    })
    if (held) return held

    const passwordHash = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: { name, phone: phone.trim(), passwordHash, role: 'gate_staff' },
      select: { id: true, name: true, phone: true, createdAt: true },
    })

    return ok(user, 201)
  } catch (e) {
    return serverError(e)
  }
}
