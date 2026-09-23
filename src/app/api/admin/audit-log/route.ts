import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { ok, forbidden, serverError } from '@/lib/api'
import { describeAuditEntry, auditUserIds } from '@/lib/auditDescribe'

// GET /api/admin/audit-log — platform-owner only, re-verified from the DB (never the JWT).
// There is deliberately no PATCH/DELETE route anywhere for AuditLog — nothing in the API
// surface can alter or remove a row once written. That absence is the tamper-evidence.
export async function GET(req: Request) {
  try {
    const session = await requireAuth().catch(() => null)
    if (!session) return forbidden()

    const owner = await prisma.user.findUnique({ where: { id: session.id }, select: { isPlatformOwner: true } })
    if (!owner?.isPlatformOwner) return forbidden()

    const url = new URL(req.url)
    const entityType = url.searchParams.get('entityType') ?? undefined
    const actorId = url.searchParams.get('actorId') ?? undefined
    const cursor = url.searchParams.get('cursor') ?? undefined
    const take = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 1), 200)

    const rows = await prisma.auditLog.findMany({
      where: {
        ...(entityType ? { entityType } : {}),
        ...(actorId ? { actorId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    })

    // Plain-language wording for each entry (who did what), with people's names filled in
    const ids = [...new Set(rows.flatMap(auditUserIds))]
    const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : []
    const names = Object.fromEntries(users.map(u => [u.id, u.name]))
    const described = rows.map(r => ({ ...r, ...describeAuditEntry(r, names), actorName: r.actorId ? names[r.actorId] ?? null : null }))

    return ok({ rows: described, nextCursor: rows.length === take ? rows[rows.length - 1].id : null })
  } catch (e) {
    return serverError(e)
  }
}
