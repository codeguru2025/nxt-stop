import { prisma } from './db'
import type { Prisma } from '@/generated/prisma/client'

export type AuditLogInput = {
  actorId?: string | null
  actorRole?: string | null
  action: string
  entityType: string
  entityId?: string | null
  before?: Prisma.InputJsonValue
  after?: Prisma.InputJsonValue
  req?: Request
}

/**
 * Fire-and-forget audit log insert. Never throws into the caller — matches the
 * degrade-gracefully convention used for email/WhatsApp elsewhere in this app.
 *
 * There is deliberately NO update/delete function here, and no route anywhere in
 * the app exposes one — that absence is the tamper-evidence mechanism for AuditLog.
 * Only a platform-owner account may ever read these rows (see
 * src/app/api/admin/audit-log/route.ts).
 */
export function writeAuditLog(input: AuditLogInput): void {
  const ip = input.req?.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
  const userAgent = input.req?.headers.get('user-agent') ?? null
  const method = input.req?.method ?? null
  const path = input.req ? new URL(input.req.url).pathname : null

  prisma.auditLog
    .create({
      data: {
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        before: input.before,
        after: input.after,
        ip,
        userAgent,
        method,
        path,
      },
    })
    .catch((err) => {
      console.error('[audit-log] write failed', err)
    })
}
