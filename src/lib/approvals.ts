import crypto from 'crypto'
import { prisma } from './db'
import { env } from './env'
import { approvalContext } from './approvalContext'
import { writeAuditLog } from './auditLog'
import { notifyAdmins } from './push'
import { isPlatformCreator } from './platformCreator'
import type { SessionUser } from './auth'
import type { AdminCapability } from './adminCapabilities'
import type { Prisma } from '@/generated/prisma/client'

/**
 * Two-admin approval ("four eyes") for serious admin changes.
 *
 * A gated route calls holdForApproval() after its own auth/validation. Unless it is
 * already running as an approved replay, that stores the request as a ChangeRequest,
 * pushes an alert to every other admin who may approve it, and answers 202 instead of
 * making the change. When a different admin approves, decideChangeRequest() replays the
 * original request through the same route handler — running as the requester, whose
 * role/capability is re-checked at that moment — so there is one code path per change.
 */

export const APPROVAL_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type Change = { label: string; from?: string | null; to?: string | null }
export type Description = {
  title: string
  changes: Change[]
  /** Entity's last-modified stamp when requested; approval fails if it changed since. */
  entityVersion?: string | null
}

// Route modules a ChangeRequest can be replayed through. Dynamic imports avoid an import
// cycle (those routes import this file).
const ROUTES = {
  '/api/admin/events': () => import('@/app/api/admin/events/route'),
  '/api/admin/events/[id]': () => import('@/app/api/admin/events/[id]/route'),
  '/api/admin/admins': () => import('@/app/api/admin/admins/route'),
  '/api/admin/admins/[id]': () => import('@/app/api/admin/admins/[id]/route'),
  '/api/admin/products': () => import('@/app/api/admin/products/route'),
  '/api/admin/products/[id]': () => import('@/app/api/admin/products/[id]/route'),
  '/api/admin/partners': () => import('@/app/api/admin/partners/route'),
  '/api/admin/referral-rewards/[id]': () => import('@/app/api/admin/referral-rewards/[id]/route'),
  '/api/admin/gate-staff': () => import('@/app/api/admin/gate-staff/route'),
  '/api/admin/gate-staff/[id]': () => import('@/app/api/admin/gate-staff/[id]/route'),
  '/api/admin/orders': () => import('@/app/api/admin/orders/route'),
  '/api/admin/password-resets/[id]': () => import('@/app/api/admin/password-resets/[id]/route'),
  '/api/admin/tickets': () => import('@/app/api/admin/tickets/route'),
} as const
export type ApprovalRoute = keyof typeof ROUTES

type RouteHandler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

// ── Body encryption: held requests can contain passwords, so the body is never stored
// in plain text and is wiped as soon as the request is decided. ──
function bodyKey(): Buffer {
  return crypto.createHash('sha256').update(`change-request-body:${env.JWT_SECRET}`).digest()
}
function encryptBody(json: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', bodyKey(), iv)
  const ct = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64')
}
function decryptBody(enc: string): string {
  const buf = Buffer.from(enc, 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', bodyKey(), buf.subarray(0, 12))
  decipher.setAuthTag(buf.subarray(12, 28))
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8')
}

/** Admins other than `excludeId` who may approve a change needing `capability`. */
export async function eligibleApproverIds(capability: string | null, excludeId: string): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: 'admin', id: { not: excludeId } },
    select: { id: true, capabilities: true, isPlatformOwner: true },
  })
  return admins
    .filter(a => a.isPlatformOwner || !capability || a.capabilities.includes(capability))
    .map(a => a.id)
}

async function canApprove(userId: string, capability: string | null): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, capabilities: true, isPlatformOwner: true } })
  return !!u && u.role === 'admin' && (u.isPlatformOwner || !capability || u.capabilities.includes(capability))
}

function pendingResponse(title: string, alreadyPending = false): Response {
  return Response.json(
    {
      success: false,
      pendingApproval: true,
      error: alreadyPending
        ? `Already waiting for approval: ${title}. Another admin must approve it before it goes live.`
        : `Sent for approval: ${title}. Another admin must approve it before it goes live.`,
    },
    { status: 202, headers: { 'x-approval-pending': '1' } }
  )
}

/**
 * Gate for a serious change. Returns null when the route should go ahead (it is the
 * approved replay, or the describer found nothing actually changing); otherwise stores
 * a ChangeRequest and returns the 202 response the route must return as-is.
 */
export async function holdForApproval(
  req: Request,
  session: SessionUser,
  opts: {
    action: string
    capability: AdminCapability
    route: ApprovalRoute
    params?: Record<string, string>
    body?: unknown
    entityType: string
    entityId?: string | null
    describe: () => Promise<Description>
  }
): Promise<Response | null> {
  if (approvalContext.getStore()) return null

  const d = await opts.describe()
  if (d.changes.length === 0) return null // a save that changes nothing needs no approval

  // The platform creator is above approvals: their change goes live straight away, and is
  // still written to the audit log with the same plain-language summary.
  if (await isPlatformCreator(session.id)) {
    writeAuditLog({
      actorId: session.id,
      actorRole: session.role,
      action: 'change.creator-direct',
      entityType: opts.entityType,
      entityId: opts.entityId ?? null,
      after: { title: d.title, changes: d.changes } as unknown as Prisma.InputJsonValue,
      req,
    })
    return null
  }

  const bodyJson = JSON.stringify(opts.body ?? null)
  const bodyHash = crypto
    .createHash('sha256')
    .update([opts.action, opts.route, JSON.stringify(opts.params ?? {}), bodyJson, session.id].join('|'))
    .digest('hex')

  const existing = await prisma.changeRequest.findFirst({
    where: { bodyHash, status: 'pending', expiresAt: { gt: new Date() } },
    select: { title: true },
  })
  if (existing) return pendingResponse(existing.title, true)

  const cr = await prisma.changeRequest.create({
    data: {
      action: opts.action,
      capability: opts.capability,
      method: req.method.toUpperCase(),
      route: opts.route,
      params: (opts.params ?? {}) as Prisma.InputJsonValue,
      bodyEnc: opts.body === undefined ? null : encryptBody(bodyJson),
      bodyHash,
      entityType: opts.entityType,
      entityId: opts.entityId ?? null,
      entityVersion: d.entityVersion ?? null,
      title: d.title,
      changes: d.changes as unknown as Prisma.InputJsonValue,
      requestedById: session.id,
      expiresAt: new Date(Date.now() + APPROVAL_TTL_MS),
    },
  })

  writeAuditLog({
    actorId: session.id,
    actorRole: session.role,
    action: 'change.requested',
    entityType: opts.entityType,
    entityId: opts.entityId ?? null,
    after: { changeRequestId: cr.id, title: d.title, changes: d.changes } as unknown as Prisma.InputJsonValue,
    req,
  })

  const approvers = await eligibleApproverIds(opts.capability, session.id)
  void notifyAdmins(
    {
      title: 'Approval needed',
      body: `${session.name} wants to: ${d.title}`,
      url: '/admin/approvals',
      tag: `approval-${cr.id}`,
    },
    { userIds: approvers }
  )
  if (approvers.length === 0) {
    console.warn(`[approvals] no eligible approver for ${opts.action} requested by ${session.id}`)
  }

  return pendingResponse(d.title)
}

/** Marks pending requests past their expiry as expired (and wipes their bodies). */
export async function expireStaleRequests(): Promise<void> {
  await prisma.changeRequest.updateMany({
    where: { status: 'pending', expiresAt: { lte: new Date() } },
    data: { status: 'expired', bodyEnc: null },
  })
}

/** Current last-modified stamp of the entity a request targets, for staleness checks. */
export async function entityVersion(entityType: string, entityId: string | null | undefined): Promise<string | null> {
  if (!entityId) return null
  const iso = (d?: Date | null) => (d ? d.toISOString() : null)
  switch (entityType) {
    case 'Event': {
      const e = await prisma.event.findUnique({
        where: { id: entityId },
        select: { updatedAt: true, ticketTypes: { select: { updatedAt: true } } },
      })
      if (!e) return 'deleted'
      const stamps = [e.updatedAt, ...e.ticketTypes.map(t => t.updatedAt)].map(d => d.getTime())
      return new Date(Math.max(...stamps)).toISOString()
    }
    case 'Product': return iso((await prisma.product.findUnique({ where: { id: entityId }, select: { updatedAt: true } }))?.updatedAt) ?? 'deleted'
    case 'Partner': return iso((await prisma.partner.findUnique({ where: { id: entityId }, select: { updatedAt: true } }))?.updatedAt) ?? 'deleted'
    case 'User': return iso((await prisma.user.findUnique({ where: { id: entityId }, select: { updatedAt: true } }))?.updatedAt) ?? 'deleted'
    case 'Order': return iso((await prisma.order.findUnique({ where: { id: entityId }, select: { updatedAt: true } }))?.updatedAt) ?? 'deleted'
    default: return null
  }
}

export type DecisionResult =
  | { ok: true; status: 'applied' | 'rejected' | 'cancelled'; message: string }
  | { ok: false; status?: 'failed' | 'expired'; message: string; httpStatus: number }

/**
 * Approve, reject or cancel a pending request. Approve/reject must come from a different
 * admin who is allowed to approve it; cancel only from the requester.
 */
export async function decideChangeRequest(
  id: string,
  reviewer: SessionUser,
  decision: 'approve' | 'reject' | 'cancel',
  note: string | null,
  req?: Request
): Promise<DecisionResult> {
  await expireStaleRequests()
  const cr = await prisma.changeRequest.findUnique({
    where: { id },
    include: { requestedBy: { select: { name: true } } },
  })
  if (!cr) return { ok: false, message: 'Request not found', httpStatus: 404 }
  if (cr.status === 'expired') return { ok: false, status: 'expired', message: 'This request expired — ask for a new one', httpStatus: 409 }
  if (cr.status !== 'pending') return { ok: false, message: `This request was already ${cr.status}`, httpStatus: 409 }

  const audit = (action: string, extra: Record<string, unknown> = {}) =>
    writeAuditLog({
      actorId: reviewer.id,
      actorRole: reviewer.role,
      action,
      entityType: cr.entityType,
      entityId: cr.entityId,
      after: { changeRequestId: cr.id, title: cr.title, requestedBy: cr.requestedBy.name, ...extra } as Prisma.InputJsonValue,
      req,
    })
  const tellRequester = (title: string, body: string) =>
    void notifyAdmins({ title, body, url: '/admin/approvals', tag: `approval-${cr.id}` }, { userIds: [cr.requestedById] })

  if (decision === 'cancel') {
    if (reviewer.id !== cr.requestedById) return { ok: false, message: 'Only the admin who asked can cancel a request', httpStatus: 403 }
    const { count } = await prisma.changeRequest.updateMany({
      where: { id, status: 'pending' },
      data: { status: 'cancelled', reviewedAt: new Date(), bodyEnc: null },
    })
    if (count === 0) return { ok: false, message: 'This request was already decided', httpStatus: 409 }
    audit('change.cancelled')
    return { ok: true, status: 'cancelled', message: 'Request cancelled' }
  }

  if (reviewer.id === cr.requestedById) {
    return { ok: false, message: 'You can’t approve or reject your own request — another admin must', httpStatus: 403 }
  }
  if (!(await canApprove(reviewer.id, cr.capability))) {
    return { ok: false, message: 'You don’t have access to this section, so you can’t decide this request', httpStatus: 403 }
  }

  if (decision === 'reject') {
    const { count } = await prisma.changeRequest.updateMany({
      where: { id, status: 'pending' },
      data: { status: 'rejected', reviewedById: reviewer.id, reviewedAt: new Date(), reviewNote: note, bodyEnc: null },
    })
    if (count === 0) return { ok: false, message: 'This request was already decided', httpStatus: 409 }
    audit('change.rejected', note ? { note } : {})
    tellRequester('Change rejected', `${reviewer.name} rejected: ${cr.title}${note ? ` — “${note}”` : ''}`)
    return { ok: true, status: 'rejected', message: 'Request rejected' }
  }

  // ── approve: claim it first so two admins approving at once can't apply it twice ──
  const { count } = await prisma.changeRequest.updateMany({
    where: { id, status: 'pending' },
    data: { status: 'applying', reviewedById: reviewer.id, reviewedAt: new Date(), reviewNote: note },
  })
  if (count === 0) return { ok: false, message: 'This request was already decided', httpStatus: 409 }

  const fail = async (reason: string): Promise<DecisionResult> => {
    await prisma.changeRequest.update({ where: { id }, data: { status: 'failed', failureReason: reason, bodyEnc: null } })
    audit('change.failed', { reason })
    tellRequester('Approved change could not be applied', `${cr.title}: ${reason}`)
    return { ok: false, status: 'failed', message: reason, httpStatus: 409 }
  }

  if (cr.entityVersion && (await entityVersion(cr.entityType, cr.entityId)) !== cr.entityVersion) {
    return fail('It was changed by someone else after this request was made — ask for a fresh request so the new details can be checked')
  }

  const load = ROUTES[cr.route as ApprovalRoute]
  if (!load) return fail(`Unknown route ${cr.route}`)
  const mod = (await load()) as unknown as Record<string, RouteHandler | undefined>
  const handler = mod[cr.method]
  if (!handler) return fail(`No ${cr.method} handler for ${cr.route}`)

  const body = cr.bodyEnc ? decryptBody(cr.bodyEnc) : null
  const params = (cr.params ?? {}) as Record<string, string>
  const path = cr.route.replace(/\[(\w+)\]/g, (_, k: string) => encodeURIComponent(params[k] ?? ''))
  const replayReq = new Request(new URL(path, env.APP_URL), {
    method: cr.method,
    headers: { 'content-type': 'application/json', 'user-agent': req?.headers.get('user-agent') ?? 'approval-replay' },
    body: body === null || body === 'null' ? undefined : body,
  })

  let res: Response
  try {
    res = await approvalContext.run(
      { changeRequestId: cr.id, requesterId: cr.requestedById, reviewerId: reviewer.id },
      () => handler(replayReq, { params: Promise.resolve(params) })
    )
  } catch (err) {
    console.error('[approvals] replay threw', err)
    return fail('Something went wrong while applying the change')
  }
  const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null
  if (res.status === 401 || res.status === 403) {
    return fail('The admin who asked no longer has access to this section (or their account was removed), so the change was not made')
  }
  if (!res.ok || json?.success === false) {
    return fail(json?.error ?? `The change could not be applied (HTTP ${res.status})`)
  }

  await prisma.changeRequest.update({ where: { id }, data: { status: 'applied', bodyEnc: null } })
  audit('change.approved')
  tellRequester('Change approved', `${reviewer.name} approved: ${cr.title} — it is now live`)
  return { ok: true, status: 'applied', message: 'Approved — the change is now live' }
}
