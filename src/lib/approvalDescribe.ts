import { prisma } from './db'
import { entityVersion, type Change, type Description } from './approvals'
import { formatDate, eventLocalInputToUtc } from './utils'
import { ADMIN_CAPABILITY_LABELS, isAdminCapability } from './adminCapabilities'
import { FEATURES } from './features'
import { getReferralPercent } from './referralRate'

// Plain-language descriptions of held changes, shown to the admin asked to approve them.
// Every describer lists only what would actually change; passwords are never included.

/* eslint-disable @typescript-eslint/no-explicit-any -- request bodies are loosely typed JSON */

const money = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : `$${Number(v).toFixed(2)}`)
const yesNo = (v: unknown) => (v ? 'Yes' : 'No')
const text = (v: unknown, max = 80) => {
  if (v === null || v === undefined || v === '') return '—'
  const s = String(v)
  return s.length > max ? `${s.slice(0, max)}…` : s
}
const when = (d: Date | string | null | undefined) => (d ? `${formatDate(d, 'EEE d MMM yyyy, h:mm a')} CAT` : '—')

const EVENT_STATUS: Record<string, string> = {
  draft: 'Draft (hidden)', published: 'Published (on sale)', live: 'Live', ended: 'Ended', cancelled: 'Cancelled',
}
const SALES_CHANNEL: Record<string, string> = {
  both: 'Advance & gate', advance: 'Advance only (closes on event day)', gate: 'Gate only (on sale on event day)',
}
const capList = (caps: unknown) =>
  Array.isArray(caps) && caps.length
    ? caps.filter((c): c is string => typeof c === 'string').map(c => (isAdminCapability(c) ? ADMIN_CAPABILITY_LABELS[c] : c)).join(', ')
    : 'No sections'

/** Push a change only if the value really differs. */
function diff(out: Change[], label: string, from: unknown, to: unknown, fmt: (v: unknown) => string = v => text(v)) {
  const a = fmt(from)
  const b = fmt(to)
  if (a !== b) out.push({ label, from: a, to: b })
}

// ── Events ───────────────────────────────────────────────────────────────────

export async function describeEventUpdate(id: string, body: any): Promise<Description> {
  const ev = await prisma.event.findUnique({ where: { id }, include: { ticketTypes: true } })
  if (!ev) return { title: 'Edit an event that no longer exists', changes: [{ label: 'Event', from: id, to: 'not found' }] }
  const c: Change[] = []
  if (body.name) diff(c, 'Event name', ev.name, body.name)
  if (body.venue) diff(c, 'Venue', ev.venue, body.venue)
  if (body.address !== undefined) diff(c, 'Address', ev.address, body.address)
  if (body.date) diff(c, 'Starts', when(ev.date), when(eventLocalInputToUtc(body.date)), v => String(v))
  if (body.endDate !== undefined) {
    diff(c, 'Ends', when(ev.endDate), body.endDate ? when(eventLocalInputToUtc(body.endDate)) : '—', v => String(v))
  }
  if (body.status) diff(c, 'Status', ev.status, body.status, v => EVENT_STATUS[String(v)] ?? String(v))
  if (body.description !== undefined && (body.description ?? '') !== (ev.description ?? '')) {
    c.push({ label: 'Description', from: text(ev.description, 60), to: text(body.description, 60) })
  }
  if (body.posterImage !== undefined && (body.posterImage || null) !== (ev.posterImage || null)) c.push({ label: 'Poster image', from: 'old image', to: body.posterImage ? 'new image' : 'removed' })
  if (body.bannerImage !== undefined && (body.bannerImage || null) !== (ev.bannerImage || null)) c.push({ label: 'Banner image', from: 'old image', to: body.bannerImage ? 'new image' : 'removed' })
  if (body.videoUrl !== undefined) diff(c, 'Video link', ev.videoUrl, body.videoUrl)
  if (body.lineup !== undefined) {
    const next = body.lineup ? JSON.stringify(body.lineup) : null
    if ((next ?? null) !== (ev.lineup ?? null)) c.push({ label: 'Line-up', from: 'previous line-up', to: 'updated line-up' })
  }
  if (body.platformFee !== undefined) diff(c, 'Booking fee per ticket', Number(ev.platformFee), body.platformFee, money)
  if (body.hasVirtual !== undefined) diff(c, 'Online stream offered', ev.hasVirtual, body.hasVirtual, yesNo)
  if (body.virtualPrice !== undefined) diff(c, 'Online stream price', ev.virtualPrice, body.virtualPrice, money)
  if (body.virtualStreamUrl !== undefined) diff(c, 'Online stream link', ev.virtualStreamUrl, body.virtualStreamUrl)
  if (body.virtualActive !== undefined) diff(c, 'Online stream switched on', ev.virtualActive, body.virtualActive, yesNo)
  if (body.lat !== undefined || body.lng !== undefined) {
    const was = ev.lat != null && ev.lng != null ? `${ev.lat.toFixed(4)}, ${ev.lng.toFixed(4)}` : '—'
    const lat = body.lat !== undefined ? body.lat : ev.lat
    const lng = body.lng !== undefined ? body.lng : ev.lng
    const now = lat != null && lat !== '' && lng != null && lng !== '' ? `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}` : '—'
    if (was !== now) c.push({ label: 'Map location', from: was, to: now })
  }

  for (const tt of Array.isArray(body.ticketTypes) ? body.ticketTypes : []) {
    if (tt.id) {
      const cur = ev.ticketTypes.find(t => t.id === tt.id)
      if (!cur) continue
      const n = cur.name
      if (tt.name !== undefined) diff(c, `Ticket “${n}” — name`, cur.name, tt.name)
      if (tt.price !== undefined) diff(c, `Ticket “${n}” — price`, Number(cur.price), tt.price, money)
      if (tt.capacity !== undefined) diff(c, `Ticket “${n}” — number available`, cur.capacity, parseInt(String(tt.capacity)), v => String(v))
      if (tt.salesChannel !== undefined) diff(c, `Ticket “${n}” — when it's sold`, cur.salesChannel, tt.salesChannel, v => SALES_CHANNEL[String(v)] ?? String(v))
      if (tt.active !== undefined) diff(c, `Ticket “${n}” — on sale`, cur.active, !!tt.active, yesNo)
      if (tt.description !== undefined && (tt.description ?? '') !== (cur.description ?? '')) {
        c.push({ label: `Ticket “${n}” — description`, from: text(cur.description, 50), to: text(tt.description, 50) })
      }
    } else if (tt.name && tt.capacity) {
      c.push({
        label: 'New ticket type',
        from: null,
        to: `${tt.name} — ${money(tt.price ?? 0)}, ${parseInt(String(tt.capacity))} available, ${SALES_CHANNEL[tt.salesChannel ?? 'both']}`,
      })
    }
  }

  return { title: `Edit event “${ev.name}”`, changes: c, entityVersion: await entityVersion('Event', id) }
}

export async function describeEventCreate(body: any): Promise<Description> {
  const c: Change[] = [
    { label: 'Event name', to: text(body.name) },
    { label: 'Starts', to: body.date ? when(eventLocalInputToUtc(body.date)) : '—' },
    { label: 'Ends', to: body.endDate ? when(eventLocalInputToUtc(body.endDate)) : 'not set' },
    { label: 'Venue', to: text(body.venue) },
    { label: 'Status', to: EVENT_STATUS[body.status] ?? text(body.status) },
  ]
  for (const tt of Array.isArray(body.ticketTypes) ? body.ticketTypes : []) {
    if (tt?.name) c.push({ label: 'Ticket type', to: `${tt.name} — ${money(tt.price ?? 0)}, ${tt.capacity ?? '?'} available, ${SALES_CHANNEL[tt.salesChannel ?? 'both']}` })
  }
  return { title: `Create and publish event “${text(body.name)}”`, changes: c }
}

export async function describeEventDelete(id: string): Promise<Description> {
  const ev = await prisma.event.findUnique({ where: { id }, select: { name: true, date: true, venue: true } })
  if (!ev) return { title: 'Delete an event that no longer exists', changes: [{ label: 'Event', from: id, to: 'not found' }] }
  return {
    title: `Delete event “${ev.name}”`,
    changes: [{ label: 'Event', from: `${ev.name} — ${when(ev.date)}, ${ev.venue}`, to: 'Permanently deleted' }],
    entityVersion: await entityVersion('Event', id),
  }
}

// ── Admin accounts ───────────────────────────────────────────────────────────

export async function describeAdminCreate(body: any): Promise<Description> {
  return {
    title: `Create admin account for ${text(body.name)} (${text(body.phone)})`,
    changes: [
      { label: 'Name', to: text(body.name) },
      { label: 'Phone (login)', to: text(body.phone) },
      { label: 'Email', to: text(body.email) },
      { label: 'Access to', to: capList(body.capabilities) },
      { label: 'Password', to: 'set (hidden)' },
    ],
  }
}

export async function describeAdminUpdate(id: string, body: any): Promise<Description> {
  const u = await prisma.user.findUnique({ where: { id }, select: { name: true, email: true, capabilities: true } })
  if (!u) return { title: 'Change an admin who no longer exists', changes: [{ label: 'Admin', from: id, to: 'not found' }] }
  const c: Change[] = []
  if (body.name !== undefined) diff(c, 'Name', u.name, body.name)
  if (body.email !== undefined) diff(c, 'Email', u.email, body.email)
  if (body.capabilities !== undefined) {
    const was = new Set(u.capabilities)
    const next = new Set(Array.isArray(body.capabilities) ? body.capabilities as string[] : [])
    const added = [...next].filter(x => !was.has(x))
    const removed = [...was].filter(x => !next.has(x))
    if (added.length) c.push({ label: 'Give access to', to: capList(added) })
    if (removed.length) c.push({ label: 'Take away access to', from: capList(removed), to: 'removed' })
  }
  if (body.password) c.push({ label: 'Password', to: 'reset to a new password (hidden)' })
  return { title: `Change admin account of ${u.name}`, changes: c, entityVersion: await entityVersion('User', id) }
}

export async function describeAdminRevoke(id: string): Promise<Description> {
  const u = await prisma.user.findUnique({ where: { id }, select: { name: true, phone: true } })
  return {
    title: `Remove admin access from ${u?.name ?? id}`,
    changes: [{ label: 'Admin access', from: `${u?.name ?? id} (${u?.phone ?? '?'})`, to: 'Removed' }],
    entityVersion: await entityVersion('User', id),
  }
}

// ── Store ────────────────────────────────────────────────────────────────────

export async function describeProductCreate(body: any): Promise<Description> {
  const ev = body.eventId ? await prisma.event.findUnique({ where: { id: String(body.eventId) }, select: { name: true } }) : null
  return {
    title: `Add store item “${text(body.name)}”${ev ? ` for ${ev.name}` : ''}`,
    changes: [
      { label: 'Item', to: text(body.name) },
      { label: 'Price', to: money(body.price) },
      { label: 'Stock', to: text(body.stock) },
      { label: 'Category', to: text(body.category ?? 'drink') },
    ],
  }
}

export async function describeProductUpdate(id: string, body: any): Promise<Description> {
  const p = await prisma.product.findUnique({ where: { id } })
  if (!p) return { title: 'Change a store item that no longer exists', changes: [{ label: 'Item', from: id, to: 'not found' }] }
  const c: Change[] = []
  if ('name' in body) diff(c, 'Name', p.name, body.name)
  if ('price' in body) diff(c, 'Price', Number(p.price), body.price, money)
  if ('stock' in body) diff(c, 'Stock', p.stock, body.stock, v => String(Number(v)))
  if ('active' in body) diff(c, 'On sale', p.active, body.active, yesNo)
  if ('category' in body) diff(c, 'Category', p.category, body.category)
  if ('description' in body) diff(c, 'Description', p.description, body.description, v => text(v, 50))
  if ('isTable' in body) diff(c, 'Is a table', p.isTable, body.isTable, yesNo)
  if ('capacityPerUnit' in body) diff(c, 'Seats per table', p.capacityPerUnit, body.capacityPerUnit)
  if ('image' in body && (body.image || null) !== (p.image || null)) c.push({ label: 'Image', from: 'old image', to: body.image ? 'new image' : 'removed' })
  if ('lowStockAt' in body) diff(c, 'Low-stock warning at', p.lowStockAt, body.lowStockAt, v => String(Number(v)))
  return { title: `Change store item “${p.name}”`, changes: c, entityVersion: await entityVersion('Product', id) }
}

export async function describeProductDelete(id: string): Promise<Description> {
  const p = await prisma.product.findUnique({ where: { id }, select: { name: true, price: true } })
  return {
    title: `Delete store item “${p?.name ?? id}”`,
    changes: [{ label: 'Item', from: p ? `${p.name} — ${money(Number(p.price))}` : id, to: 'Deleted' }],
    entityVersion: await entityVersion('Product', id),
  }
}

// ── Partners, payouts, orders ────────────────────────────────────────────────

/** `existingName` is set when the phone already has an account that will be made a partner. */
export async function describePartnerCreate(body: any, existingName: string | null = null): Promise<Description> {
  return {
    title: existingName
      ? `Make ${text(existingName)} a partner${body.businessName ? ` (${text(body.businessName)})` : ''}`
      : `Add partner ${text(body.name)}${body.businessName ? ` (${text(body.businessName)})` : ''}`,
    changes: [
      { label: 'Name', to: text(existingName ?? body.name) },
      { label: 'Phone (login)', to: text(body.phone) },
      { label: 'Type', to: text(body.type) },
      { label: 'Earns', to: !FEATURES.partnerCommissionRates ? `${await getReferralPercent()}% of everything bought through their link (same as everyone)` : Number(body.commissionPerTicket) > 0 ? `${money(body.commissionPerTicket)} per ticket` : `${Number(body.commissionRate ?? 10)}% of ticket sales` },
      existingName
        ? { label: 'Account', to: 'uses their existing login' }
        : { label: 'Password', to: 'set (hidden)' },
    ],
  }
}

export async function describePartnerUpdate(body: any): Promise<Description> {
  const p = await prisma.partner.findUnique({ where: { id: String(body.partnerId) }, include: { user: { select: { name: true } } } })
  if (!p) return { title: 'Change a partner who no longer exists', changes: [{ label: 'Partner', from: String(body.partnerId), to: 'not found' }] }
  const c: Change[] = []
  if (body.commissionRate !== undefined) diff(c, 'Commission %', `${Number(p.commissionRate)}%`, `${Number(body.commissionRate)}%`, v => String(v))
  if (body.commissionPerTicket !== undefined) diff(c, 'Commission per ticket', Number(p.commissionPerTicket), body.commissionPerTicket, money)
  if (body.active !== undefined) diff(c, 'Active', p.active, body.active, yesNo)
  return { title: `Change partner ${p.user.name}'s commission`, changes: c, entityVersion: await entityVersion('Partner', p.id) }
}

export async function describeReferralPayout(id: string, body: any): Promise<Description> {
  const r = await prisma.referralReward.findUnique({ where: { id }, include: { user: { select: { name: true } } } })
  if (!r) return { title: 'Change a referral payout that no longer exists', changes: [{ label: 'Payout', from: id, to: 'not found' }] }
  const label: Record<string, string> = { paid: 'Paid', pending: 'Not paid yet', cancelled: 'Cancelled' }
  const c: Change[] = []
  diff(c, `${money(Number(r.amount))} referral cash for ${r.user.name}`, r.status, body.status, v => label[String(v)] ?? String(v))
  return { title: `Mark ${money(Number(r.amount))} referral payout to ${r.user.name} as ${label[body.status]?.toLowerCase() ?? body.status}`, changes: c }
}

export async function describeOrderAction(body: any): Promise<Description> {
  const o = await prisma.order.findUnique({
    where: { id: String(body.orderId) },
    select: { orderNumber: true, total: true, status: true, whatsappName: true, guestName: true, user: { select: { name: true } } },
  })
  if (!o) return { title: 'Change an order that no longer exists', changes: [{ label: 'Order', from: String(body.orderId), to: 'not found' }] }
  const who = o.whatsappName ?? o.guestName ?? o.user?.name ?? 'customer'
  if (body.action === 'fulfill') {
    return {
      title: `Mark order #${o.orderNumber} (${money(Number(o.total))}, ${who}) as paid without payment confirmation`,
      changes: [{ label: `Order #${o.orderNumber}`, from: o.status, to: 'Paid — tickets issued' }],
      entityVersion: await entityVersion('Order', String(body.orderId)),
    }
  }
  if (body.action === 'refund') {
    return {
      title: `Refund order #${o.orderNumber} (${money(Number(o.total))}, ${who}) — cancels its tickets and vouchers and texts the customer`,
      changes: [{ label: `Order #${o.orderNumber}`, from: o.status, to: 'Refunded' }],
      entityVersion: await entityVersion('Order', String(body.orderId)),
    }
  }
  return {
    title: `Cancel order #${o.orderNumber} (${money(Number(o.total))}, ${who})`,
    changes: [{ label: `Order #${o.orderNumber}`, from: o.status, to: 'Cancelled' }],
    entityVersion: await entityVersion('Order', String(body.orderId)),
  }
}

// ── Access: gate staff, password resets, printed tickets ─────────────────────

export async function describeGateStaffCreate(body: any): Promise<Description> {
  return {
    title: `Create gate staff login for ${text(body.name)} (${text(body.phone)})`,
    changes: [
      { label: 'Name', to: text(body.name) },
      { label: 'Phone (login)', to: text(body.phone) },
      { label: 'Can', to: 'Scan tickets and sell printed tickets for cash' },
      { label: 'Password', to: 'set (hidden)' },
    ],
  }
}

export async function describeGateStaffPassword(id: string): Promise<Description> {
  const u = await prisma.user.findUnique({ where: { id }, select: { name: true, phone: true } })
  return { title: `Reset gate staff password for ${u?.name ?? id}`, changes: [{ label: `Password of ${u?.name ?? id} (${u?.phone ?? '?'})`, to: 'new password (hidden)' }] }
}

export async function describeGateStaffRemove(id: string): Promise<Description> {
  const u = await prisma.user.findUnique({ where: { id }, select: { name: true, phone: true } })
  return { title: `Remove gate staff ${u?.name ?? id}`, changes: [{ label: 'Gate staff access', from: `${u?.name ?? id} (${u?.phone ?? '?'})`, to: 'Removed' }] }
}

export async function describePasswordReset(id: string): Promise<Description> {
  const r = await prisma.passwordResetRequest.findUnique({ where: { id }, include: { user: { select: { name: true, phone: true, role: true } } } })
  if (!r) return { title: 'Handle a password reset request that no longer exists', changes: [{ label: 'Request', from: id, to: 'not found' }] }
  return {
    title: `Set a new temporary password for ${r.user.name} (${r.user.phone})`,
    changes: [{ label: `Password of ${r.user.name} (${r.user.role})`, to: 'new temporary password (hidden)' }],
  }
}

export async function describeTicketPrint(body: any): Promise<Description> {
  const tt = await prisma.ticketType.findUnique({ where: { id: String(body.ticketTypeId) }, include: { event: { select: { name: true } } } })
  const qty = parseInt(String(body.quantity))
  return {
    title: `Create ${qty} printed ticket${qty === 1 ? '' : 's'} for ${tt?.event.name ?? 'an event'} — ${tt?.name ?? 'ticket'}`,
    changes: [
      { label: 'Event', to: tt?.event.name ?? '?' },
      { label: 'Ticket type', to: tt ? `${tt.name} — ${money(Number(tt.price))} each` : '?' },
      { label: 'How many', to: String(qty) },
      { label: 'Face value if all sold', to: tt ? money(Number(tt.price) * qty) : '?' },
    ],
  }
}


// ── SMS campaigns ────────────────────────────────────────────────────────────

export async function describeSmsCampaign(body: any): Promise<Description> {
  const { CAMPAIGNS, isPromoTemplate, prepareCampaign } = await import('./smsCampaigns')
  const template = String(body.template)
  if (!isPromoTemplate(template)) return { title: 'Send a promotional SMS', changes: [{ label: 'Template', to: template }] }
  const p = await prepareCampaign({ ...body, template })
  const label = CAMPAIGNS[template].label
  if (!p.ok) return { title: `Send promotional SMS: ${label}`, changes: [{ label: 'Problem', to: p.error }] }
  return {
    title: `Send promotional SMS "${label}"${p.eventName ? ` for ${p.eventName}` : ''} to ${p.recipients.length} people (${p.creditsNeeded} credits)`,
    changes: [
      { label: 'Message', to: p.sample },
      { label: 'Recipients', to: String(p.recipients.length) },
      { label: 'Credits', from: String(p.creditsLeft), to: String(p.creditsLeft - p.creditsNeeded) },
    ],
  }
}
