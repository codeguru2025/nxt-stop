import { prisma } from '@/lib/db'
import { requireCapability, isAdminCapability } from '@/lib/auth'
import { ok, error, forbidden, notFound, serverError } from '@/lib/api'
import { writeAuditLog } from '@/lib/auditLog'
import bcrypt from 'bcryptjs'
import { holdForApproval } from '@/lib/approvals'
import { describeAdminUpdate, describeAdminRevoke } from '@/lib/approvalDescribe'

// PATCH /api/admin/admins/[id] — update name/email/capabilities, or reset password
export async function PATCH(
  req: Request,
  ctx: RouteContext<'/api/admin/admins/[id]'>
) {
  try {
    const session = await requireCapability('admins').catch(() => null)
    if (!session) return forbidden()
    const { id } = await ctx.params

    const admin = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, capabilities: true } })
    if (!admin) return notFound('Admin')
    if (admin.role !== 'admin') return error('User is not an admin', 400)

    // Note: isPlatformOwner is deliberately never destructured/accepted here — no route in
    // the app ever writes it. See prisma/scripts/seed-platform-owner.ts.
    const body = await req.json()
    const { name, email, password, capabilities } = body
    const data: { name?: string; email?: string | null; passwordHash?: string; capabilities?: string[] } = {}

    // An admin can't change their OWN capabilities — closes a self-escalation gap where an
    // `admins`-capability holder could otherwise grant themselves every other capability.
    // A different admins-capability holder must do it.
    if (capabilities !== undefined && id === session.id) {
      return error('You cannot change your own capabilities — ask another admin to do it', 403)
    }

    if (name !== undefined) {
      if (!name.trim()) return error('Name cannot be empty')
      data.name = name.trim()
    }
    if (email !== undefined) {
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error('Invalid email address')
      data.email = email?.trim() || null
    }
    if (password !== undefined) {
      if (password.length < 8) return error('Password must be at least 8 characters')
      data.passwordHash = await bcrypt.hash(password, 10)
    }
    if (capabilities !== undefined) {
      if (!Array.isArray(capabilities) || !capabilities.every(isAdminCapability)) {
        return error('Invalid capabilities')
      }
      data.capabilities = capabilities
    }

    if (Object.keys(data).length === 0) return error('Nothing to update')

    // Editing your own name/email/password is personal; changing another admin needs approval
    if (id !== session.id) {
      const held = await holdForApproval(req, session, {
        action: 'admin.update', capability: 'admins', route: '/api/admin/admins/[id]', params: { id }, body,
        entityType: 'User', entityId: id, describe: () => describeAdminUpdate(id, body),
      })
      if (held) return held
    }

    if (capabilities !== undefined && admin.capabilities.includes('admins') && !capabilities.includes('admins')) {
      // Never let a change leave the whole system with no admin able to manage admins — that
      // would be an unrecoverable lockout. Locks every admin row for the duration of the
      // transaction so two concurrent "drop my own admins capability" requests can't both
      // pass the check (each would otherwise see the other still holding it and proceed).
      const result = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT id FROM "User" WHERE role = 'admin' FOR UPDATE`
        const otherHolders = await tx.user.count({
          where: { role: 'admin', id: { not: id }, capabilities: { has: 'admins' } },
        })
        if (otherHolders === 0) return { blocked: true }
        await tx.user.update({ where: { id }, data })
        return { blocked: false }
      })
      if (result.blocked) return error('At least one admin must keep the "Admins" capability')
    } else {
      await prisma.user.update({ where: { id }, data })
    }

    writeAuditLog({
      actorId: session.id,
      actorRole: session.role,
      action: 'admin.update',
      entityType: 'User',
      entityId: id,
      before: { capabilities: admin.capabilities },
      after: { ...data, passwordHash: data.passwordHash ? '(changed)' : undefined },
      req,
    })

    return ok({ message: 'Admin updated' })
  } catch (e) {
    return serverError(e)
  }
}

// DELETE /api/admin/admins/[id] — revoke admin access (demoted to customer, not deleted —
// admins may have their own orders/tickets/scan history, unlike gate staff)
export async function DELETE(
  req: Request,
  ctx: RouteContext<'/api/admin/admins/[id]'>
) {
  try {
    const session = await requireCapability('admins').catch(() => null)
    if (!session) return forbidden()
    const { id } = await ctx.params

    if (id === session.id) return error('You cannot revoke your own admin access')

    const admin = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } })
    if (!admin) return notFound('Admin')
    if (admin.role !== 'admin') return error('User is not an admin', 400)

    const held = await holdForApproval(req, session, {
      action: 'admin.revoke', capability: 'admins', route: '/api/admin/admins/[id]', params: { id },
      entityType: 'User', entityId: id, describe: () => describeAdminRevoke(id),
    })
    if (held) return held

    // Locks every admin row for the duration of the transaction so two concurrent revokes
    // (e.g. two admins revoking each other at once) can't both pass the count check and
    // leave zero admins — the second request blocks until the first commits, then re-reads
    // the now-reduced count.
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM "User" WHERE role = 'admin' FOR UPDATE`
      const adminCount = await tx.user.count({ where: { role: 'admin' } })
      if (adminCount <= 1) return { blocked: true }
      await tx.user.update({ where: { id }, data: { role: 'customer' } })
      return { blocked: false }
    })
    if (result.blocked) return error('Cannot remove the last remaining admin')

    writeAuditLog({
      actorId: session.id,
      actorRole: session.role,
      action: 'admin.revoke',
      entityType: 'User',
      entityId: id,
      before: { role: 'admin' },
      after: { role: 'customer' },
      req,
    })

    return ok({ message: 'Admin access revoked' })
  } catch (e) {
    return serverError(e)
  }
}
