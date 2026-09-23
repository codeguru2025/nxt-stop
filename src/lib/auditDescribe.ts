import { ADMIN_CAPABILITY_LABELS, isAdminCapability } from './adminCapabilities'

// Turns raw AuditLog rows into plain sentences anyone can follow — used by the admin
// Audit Log page and the daily audit PDF. Keep it free of server-only imports.

export type AuditCategory = 'security' | 'approval' | 'money' | 'access' | 'sales' | 'events' | 'other'

export type AuditRow = {
  action: string
  entityType: string
  entityId: string | null
  before: unknown
  after: unknown
  actorId: string | null
  actorRole?: string | null
}

export type AuditDescription = {
  /** One sentence, starting with who did it. */
  summary: string
  /** Extra lines, e.g. each field that changed. */
  details: string[]
  category: AuditCategory
  /** Worth drawing the eye to (failed logins, rejections, failures, removals). */
  alert: boolean
}

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {})
const str = (v: unknown) => (v === null || v === undefined || v === '' ? '' : String(v))
const quote = (v: unknown) => (str(v) ? `“${str(v)}”` : '')
const capList = (caps: unknown) =>
  Array.isArray(caps) && caps.length
    ? caps.map(c => (typeof c === 'string' && isAdminCapability(c) ? ADMIN_CAPABILITY_LABELS[c] : String(c))).join(', ')
    : 'no sections'

const ROLE: Record<string, string> = { admin: 'admin', gate_staff: 'gate staff', customer: 'customer', partner: 'partner' }

function changeLines(changes: unknown): string[] {
  if (!Array.isArray(changes)) return []
  return changes.map(c => {
    const o = obj(c)
    const from = str(o.from)
    return from ? `${str(o.label)}: ${from} → ${str(o.to) || '—'}` : `${str(o.label)}: ${str(o.to) || '—'}`
  })
}

/**
 * @param names  display names for user ids (actors and users an entry refers to)
 */
export function describeAuditEntry(row: AuditRow, names: Record<string, string> = {}): AuditDescription {
  const who = row.actorId ? names[row.actorId] ?? 'An unknown user' : 'Someone (not logged in)'
  const role = row.actorRole ? ROLE[row.actorRole] ?? row.actorRole : ''
  const a = obj(row.after)
  const b = obj(row.before)
  const target = row.entityId ? names[row.entityId] : undefined
  const d = (summary: string, category: AuditCategory, details: string[] = [], alert = false): AuditDescription =>
    ({ summary, category, details, alert })

  switch (row.action) {
    // ── Logins ──
    case 'auth.login.success':
      return d(`${who}${role ? ` (${role})` : ''} logged in`, 'security')
    case 'auth.login.failure':
      return d(
        target
          ? `Failed login: someone entered the wrong password for ${target}'s account`
          : 'Failed login: someone tried to log in with a phone number that has no account',
        'security', [], true
      )

    // ── Two-admin approvals ──
    case 'change.requested':
      return d(`${who} asked for approval to: ${str(a.title)}`, 'approval', changeLines(a.changes))
    case 'change.approved':
      return d(`${who} approved: ${str(a.title)} (asked by ${str(a.requestedBy) || 'another admin'}) — it is now live`, 'approval')
    case 'change.rejected':
      return d(
        `${who} rejected: ${str(a.title)} (asked by ${str(a.requestedBy) || 'another admin'})`,
        'approval', a.note ? [`Reason given: “${str(a.note)}”`] : [], true
      )
    case 'change.cancelled':
      return d(`${who} withdrew their own request: ${str(a.title)}`, 'approval')
    case 'change.failed':
      return d(`${who} approved: ${str(a.title)} — but it could not be applied, so nothing changed`, 'approval', a.reason ? [`Why: ${str(a.reason)}`] : [], true)

    // ── Admin accounts ──
    case 'admin.create':
      return d(`${who} created an admin account for ${str(a.name)} (${str(a.phone)})`, 'access', [`Access to: ${capList(a.capabilities)}`])
    case 'admin.update': {
      const lines: string[] = []
      if (a.capabilities !== undefined) lines.push(`Access changed from: ${capList(b.capabilities)} → to: ${capList(a.capabilities)}`)
      if (a.name !== undefined) lines.push(`Name set to ${quote(a.name)}`)
      if (a.email !== undefined) lines.push(`Email set to ${str(a.email) || '(none)'}`)
      if (a.passwordHash) lines.push('Password was changed')
      return d(`${who} changed the admin account of ${target ?? 'an admin'}`, 'access', lines)
    }
    case 'admin.revoke':
      return d(`${who} removed admin access from ${target ?? 'an admin'}`, 'access', [], true)

    // ── Money ──
    case 'referral-reward.update': {
      const label: Record<string, string> = { paid: 'paid', pending: 'not paid yet', cancelled: 'cancelled' }
      return d(
        `${who} marked a referral cash payout${target ? ` to ${target}` : ''} as ${label[str(a.status)] ?? str(a.status)}`,
        'money', b.status ? [`It was: ${label[str(b.status)] ?? str(b.status)}`] : []
      )
    }

    // ── Sales ──
    case 'ticket.physical.activate': {
      const buyer = a.buyerId ? names[str(a.buyerId)] : undefined
      return d(
        `${who} sold a printed ticket for cash${buyer ? ` to ${buyer}` : ''}`,
        'sales',
        [
          a.orderNumber ? `Order #${str(a.orderNumber)}` : '',
          a.accountCreated ? 'A new customer account was created for the buyer' : 'Added to the buyer’s existing account',
        ].filter(Boolean)
      )
    }

    // ── Teams ──
    case 'team.create': return d(`${who} created the street team ${quote(a.name)}`, 'other')
    case 'team.update': return d(`${who} renamed street team ${quote(b.name)} to ${quote(a.name)}`, 'other')
    case 'team.delete': return d(`${who} deleted the street team ${quote(b.name)}`, 'other', [], true)
    case 'team.member.add': return d(`${who} added ${str(a.name) || 'someone'} to a street team`, 'other')
    case 'team.member.remove': {
      const removed = b.userId ? names[str(b.userId)] : undefined
      return d(`${who} removed ${removed ?? 'someone'} from a street team`, 'other')
    }
  }

  // Anything not yet given its own wording: still readable, never the raw code alone
  const words = row.action.replace(/[._-]+/g, ' ').trim()
  return d(`${who}: ${words}${row.entityType ? ` (${row.entityType})` : ''}`, 'other')
}

/** Every user id an entry may need a name for. */
export function auditUserIds(row: AuditRow): string[] {
  const a = obj(row.after)
  const b = obj(row.before)
  return [row.actorId, row.entityType === 'User' ? row.entityId : null, str(a.buyerId), str(b.userId)]
    .filter((x): x is string => !!x)
}
