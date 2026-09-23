import { jsPDF } from 'jspdf'
import { prisma } from './db'
import { LOGO_URL, fetchDataUri } from './ticketAttachment'
import { EVENT_TIME_ZONE } from './utils'
import { describeAuditEntry, auditUserIds, type AuditCategory } from './auditDescribe'

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
  { label: 'WHAT HAPPENED', w: 190 },
  { label: 'TYPE', w: 28 },
  { label: 'FROM IP', w: 25 },
]

const CATEGORY_LABEL: Record<AuditCategory, string> = {
  security: 'Login', approval: 'Approval', money: 'Money', access: 'Admin access',
  sales: 'Sale', events: 'Event', other: 'Other',
}

// The PDF's built-in font has no arrow glyph
const pdfSafe = (t: string) => t.replace(/→/g, '->')

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
  const userIds = [...new Set(entries.flatMap(auditUserIds))]
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : []
  const names = Object.fromEntries(users.map(u => [u.id, u.name]))
  const described = entries.map(e => ({ e, d: describeAuditEntry(e, names) }))

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
  const count = (action: string) => entries.filter(e => e.action === action).length
  const failedLogins = count('auth.login.failure')
  const needsLook = described.filter(x => x.d.alert).length

  const tiles: { label: string; value: string; alert?: boolean }[] = [
    { label: 'THINGS THAT HAPPENED', value: String(entries.length) },
    { label: 'PEOPLE INVOLVED', value: String(actorIds.length) },
    { label: 'CHANGES APPROVED', value: String(count('change.approved')) },
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
  {
    const x = M + 4 * (tileW + 4)
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text('WORTH A CLOSER LOOK', x, y + 5.5)
    doc.setFontSize(8.5)
    doc.setTextColor(...(needsLook ? PINK : INK))
    doc.text(
      needsLook ? `${needsLook} entr${needsLook === 1 ? 'y is' : 'ies are'} shown in pink below` : 'Nothing unusual',
      x, y + 12, { maxWidth: PAGE_W - M - x }
    )
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
  described.forEach(({ e, d }, i) => {
    const what = pdfSafe([d.summary, ...d.details.map(l => `   • ${l}`)].join('\n'))
    const cells = [catTime.format(e.createdAt), what, CATEGORY_LABEL[d.category], e.ip ?? '—']
    doc.setFontSize(7.5)
    const wrapped = cells.map((text, ci) => doc.splitTextToSize(text, COLS[ci].w - 4) as string[])
    // Cap very long entries so a single row can never exceed a page
    wrapped[1] = wrapped[1].length > 12 ? [...wrapped[1].slice(0, 11), '   ...'] : wrapped[1]
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
      if (ci === 1) {
        // First line is the sentence (bold; pink when worth a closer look), rest are details
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...(d.alert ? PINK : INK))
        doc.text(lines[0] ?? '', x + 2, y + 4)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...MUTED)
        if (lines.length > 1) doc.text(lines.slice(1), x + 2, y + 4 + LINE_H)
      } else {
        doc.setFont('helvetica', ci === 2 ? 'bold' : 'normal')
        doc.setTextColor(...(ci === 2 ? PURPLE : MUTED))
        doc.text(lines, x + 2, y + 4)
      }
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
