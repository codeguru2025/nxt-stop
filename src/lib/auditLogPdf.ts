import { jsPDF } from 'jspdf'
import { prisma } from './db'
import { LOGO_URL, fetchDataUri } from './ticketAttachment'
import { EVENT_TIME_ZONE } from './utils'

// Brand palette — same purple → pink gradient stops as the ticket card (ticketAttachment.ts)
const PURPLE: [number, number, number] = [124, 58, 237]
const VIOLET: [number, number, number] = [147, 51, 234]
const PINK: [number, number, number] = [219, 39, 119]
const INK: [number, number, number] = [17, 24, 39]
const MUTED: [number, number, number] = [107, 114, 128]
const RULE: [number, number, number] = [229, 231, 235]
const ZEBRA: [number, number, number] = [249, 250, 251]

const PAGE_W = 297 // A4 landscape, mm
const PAGE_H = 210
const M = 12

const catDateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: EVENT_TIME_ZONE, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
})
const catTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: EVENT_TIME_ZONE, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
})

// Column layout: label, width (mm). Widths sum to PAGE_W - 2*M = 273.
const COLS: { label: string; w: number }[] = [
  { label: 'TIME (CAT)', w: 30 },
  { label: 'ACTOR', w: 45 },
  { label: 'ACTION', w: 48 },
  { label: 'ENTITY', w: 40 },
  { label: 'IP', w: 26 },
  { label: 'DETAILS', w: 84 },
]

/** Compact one-line summary of a JSON before/after payload for the DETAILS column. */
function summarize(before: unknown, after: unknown): string {
  const fmt = (v: unknown) => {
    if (v == null) return ''
    if (typeof v !== 'object') return String(v)
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => `${k}: ${typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val)}`)
      .join(', ')
  }
  const b = fmt(before)
  const a = fmt(after)
  if (b && a) return `before — ${b}  |  after — ${a}`
  return a || b || '—'
}

function accentBar(doc: jsPDF, y: number, h: number) {
  const third = PAGE_W / 3
  doc.setFillColor(...PURPLE); doc.rect(0, y, third, h, 'F')
  doc.setFillColor(...VIOLET); doc.rect(third, y, third, h, 'F')
  doc.setFillColor(...PINK); doc.rect(third * 2, y, third + 1, h, 'F')
}

/**
 * Renders every AuditLog row in [windowStart, windowEnd] as a branded A4-landscape PDF,
 * for the daily report sent to the accounts allowed to see the audit log.
 */
export async function createAuditLogPdf(windowStart: Date, windowEnd: Date): Promise<{ pdf: Buffer; count: number }> {
  const [entries, logoDataUri] = await Promise.all([
    prisma.auditLog.findMany({
      where: { createdAt: { gte: windowStart, lte: windowEnd } },
      orderBy: { createdAt: 'asc' },
    }),
    fetchDataUri(LOGO_URL),
  ])

  const actorIds = [...new Set(entries.map(e => e.actorId).filter(Boolean))] as string[]
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, phone: true } })
    : []
  const actorMap = new Map(actors.map(a => [a.id, a]))

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })

  // ── Header (first page) ──
  accentBar(doc, 0, 4)
  let y = 12
  if (logoDataUri) {
    try {
      const props = doc.getImageProperties(logoDataUri)
      const logoH = 12
      const logoW = Math.min((logoH * props.width) / props.height, 40)
      doc.addImage(logoDataUri, M, y, logoW, logoH, undefined, 'FAST')
    } catch { /* logo is decoration — render without it */ }
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...INK)
  doc.text('Audit Log — Daily Report', PAGE_W - M, y + 6, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text(
    `${catDateTime.format(windowStart)} to ${catDateTime.format(windowEnd)} (CAT)`,
    PAGE_W - M, y + 12, { align: 'right' }
  )

  // ── Summary strip ──
  y = 32
  const byAction = new Map<string, number>()
  for (const e of entries) byAction.set(e.action, (byAction.get(e.action) ?? 0) + 1)
  const failedLogins = byAction.get('auth.login.failure') ?? 0
  const topActions = [...byAction.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)

  const tiles: { label: string; value: string; alert?: boolean }[] = [
    { label: 'TOTAL ENTRIES', value: String(entries.length) },
    { label: 'DISTINCT ACTORS', value: String(actorIds.length) },
    { label: 'FAILED LOGINS', value: String(failedLogins), alert: failedLogins > 0 },
  ]
  const tileW = 50
  tiles.forEach((t, i) => {
    const x = M + i * (tileW + 4)
    doc.setFillColor(...ZEBRA)
    doc.setDrawColor(...RULE)
    doc.roundedRect(x, y, tileW, 16, 2, 2, 'FD')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(t.label, x + 4, y + 5.5)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...(t.alert ? PINK : PURPLE))
    doc.text(t.value, x + 4, y + 13)
    doc.setFont('helvetica', 'normal')
  })
  if (topActions.length) {
    const x = M + 3 * (tileW + 4)
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text('MOST FREQUENT ACTIONS', x, y + 5.5)
    doc.setFontSize(8.5)
    doc.setTextColor(...INK)
    doc.text(topActions.map(([a, n]) => `${a} × ${n}`).join('    '), x, y + 12, { maxWidth: PAGE_W - M - x })
  }
  y += 24

  // ── Table ──
  const drawHeaderRow = () => {
    doc.setFillColor(...INK)
    doc.rect(M, y, PAGE_W - 2 * M, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(255, 255, 255)
    let x = M
    for (const c of COLS) { doc.text(c.label, x + 2, y + 4.7); x += c.w }
    doc.setFont('helvetica', 'normal')
    y += 7
  }
  drawHeaderRow()

  if (entries.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(...MUTED)
    doc.text('No audit activity in this period.', M + 2, y + 8)
  }

  const FOOTER_TOP = PAGE_H - 14
  const LINE_H = 3.4
  entries.forEach((e, i) => {
    const actor = e.actorId ? actorMap.get(e.actorId) : undefined
    const cells = [
      catTime.format(e.createdAt),
      actor ? `${actor.name}${e.actorRole ? ` (${e.actorRole})` : ''}\n${actor.phone}` : e.actorId ? e.actorId : 'System / anonymous',
      e.action,
      `${e.entityType}${e.entityId ? `\n${e.entityId}` : ''}`,
      e.ip ?? '—',
      summarize(e.before, e.after),
    ]
    doc.setFontSize(7.5)
    const wrapped = cells.map((text, ci) => doc.splitTextToSize(text, COLS[ci].w - 4) as string[])
    // Cap very long detail payloads so a single row can never exceed a page
    wrapped[5] = wrapped[5].length > 8 ? [...wrapped[5].slice(0, 7), '...'] : wrapped[5]
    const rowH = Math.max(...wrapped.map(w => w.length)) * LINE_H + 3

    if (y + rowH > FOOTER_TOP) {
      doc.addPage()
      accentBar(doc, 0, 2)
      y = 10
      drawHeaderRow()
    }
    if (i % 2 === 1) {
      doc.setFillColor(...ZEBRA)
      doc.rect(M, y, PAGE_W - 2 * M, rowH, 'F')
    }
    let x = M
    wrapped.forEach((lines, ci) => {
      doc.setTextColor(...(ci === 2 ? PURPLE : ci === 0 || ci === 4 ? MUTED : INK))
      doc.setFont('helvetica', ci === 2 ? 'bold' : 'normal')
      doc.text(lines, x + 2, y + 4)
      x += COLS[ci].w
    })
    doc.setDrawColor(...RULE)
    doc.line(M, y + rowH, PAGE_W - M, y + rowH)
    y += rowH
  })

  // ── Footer on every page ──
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    doc.text('NXT STOP  ·  Confidential — for platform owner accounts only', M, PAGE_H - 8)
    doc.text(`Generated ${catDateTime.format(new Date())} CAT  ·  Page ${p} of ${pages}`, PAGE_W - M, PAGE_H - 8, { align: 'right' })
    accentBar(doc, PAGE_H - 3, 3)
  }

  return { pdf: Buffer.from(doc.output('arraybuffer')), count: entries.length }
}
