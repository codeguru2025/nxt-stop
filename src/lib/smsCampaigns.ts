import { prisma } from './db'
import { sendSms } from './sms'
import { smsCredits } from './smsCredits'
import { getReferralPercent } from './referralRate'
import { PROMO_TEMPLATES, smsSegments, type PromoFields, type PromoTemplate } from './smsTemplates'
import { formatDate, lowestOnSalePrice } from './utils'

type Field = 'price' | 'deadline' | 'ticketType'

export const CAMPAIGNS: Record<PromoTemplate, { label: string; audience: string; event: 'upcoming' | 'past' | null; fields: Field[] }> = {
  'new-event': { label: 'New event announcement', audience: 'Everyone opted in without a ticket for it', event: 'upcoming', fields: ['price'] },
  'early-bird': { label: 'Early-bird deadline', audience: 'Everyone opted in without a ticket for it', event: 'upcoming', fields: ['price', 'deadline'] },
  'almost-sold-out': { label: 'Almost sold out', audience: 'Everyone opted in without a ticket for it', event: 'upcoming', fields: ['ticketType'] },
  'last-chance': { label: 'Last chance, the day before', audience: 'Everyone opted in without a ticket for it', event: 'upcoming', fields: [] },
  'share-link': { label: 'Share your link (earn %)', audience: 'People holding a ticket for it', event: 'upcoming', fields: [] },
  'thank-you': { label: 'Thank you after the event', audience: 'People whose ticket was scanned at it', event: 'past', fields: [] },
  'win-back': { label: "Win back people who haven't bought in a while", audience: 'Opted-in buyers with no purchase in 90 days', event: null, fields: [] },
}

export const isPromoTemplate = (t: string): t is PromoTemplate => t in CAMPAIGNS

export type CampaignInput = { template: PromoTemplate; eventId?: string; price?: number; deadline?: string; ticketType?: string }

type Recipient = { userId: string; phone: string; referralCode: string }

const WIN_BACK_DAYS = 90
// Staff accounts aren't marketed to
const MARKETABLE = { smsOptOutAt: null, role: { in: ['customer', 'partner'] } }

function audienceWhere(template: PromoTemplate, eventId: string | null) {
  switch (template) {
    case 'share-link':
      return { ...MARKETABLE, tickets: { some: { eventId: eventId!, status: 'valid' } } }
    case 'thank-you':
      return { ...MARKETABLE, tickets: { some: { eventId: eventId!, status: 'used' } } }
    case 'win-back':
      return {
        ...MARKETABLE,
        orders: {
          some: { status: 'paid' },
          none: { status: 'paid', paidAt: { gte: new Date(Date.now() - WIN_BACK_DAYS * 24 * 3600e3) } },
        },
      }
    default:
      return { ...MARKETABLE, tickets: { none: { eventId: eventId!, status: { in: ['valid', 'used'] } } } }
  }
}

export type PreparedCampaign = {
  input: CampaignInput
  recipients: Recipient[]
  render: (r: Recipient) => string
  sample: string
  creditsNeeded: number
  creditsLeft: number
  eventName: string | null
  alreadySent: number // earlier campaigns of this template for this event
}

/** Works out who a campaign goes to and what it says, without sending anything. */
export async function prepareCampaign(input: CampaignInput): Promise<{ ok: false; error: string } | ({ ok: true } & PreparedCampaign)> {
  const info = CAMPAIGNS[input.template]
  let fields: PromoFields = {
    eventName: '', slug: '', date: '', venue: '', price: 0, deadline: '', ticketType: '', referralCode: '', referralPercent: 0,
  }
  let eventId: string | null = null
  let eventName: string | null = null

  if (info.event) {
    if (!input.eventId) return { ok: false, error: 'Pick an event' }
    const event = await prisma.event.findUnique({
      where: { id: input.eventId },
      select: {
        id: true, name: true, slug: true, date: true, venue: true, status: true,
        ticketTypes: { where: { active: true }, select: { price: true, sold: true, capacity: true, salesChannel: true } },
      },
    })
    if (!event) return { ok: false, error: 'Event not found' }
    const upcoming = event.date > new Date() && ['published', 'live'].includes(event.status)
    if (info.event === 'upcoming' && !upcoming) return { ok: false, error: 'This message is for an upcoming, published event' }
    if (info.event === 'past' && event.date > new Date()) return { ok: false, error: 'Thank-you messages are for events that have happened' }

    const price = input.price ?? lowestOnSalePrice(event.date, event.ticketTypes.map(t => ({
      price: Number(t.price), soldOut: t.sold >= t.capacity, salesChannel: t.salesChannel,
    })))
    if (info.fields.includes('price') && !(price > 0)) return { ok: false, error: 'Enter the ticket price to advertise' }
    if (info.fields.includes('deadline') && !input.deadline?.trim()) return { ok: false, error: 'Enter when the early bird ends, e.g. "Friday midnight"' }
    if (info.fields.includes('ticketType') && !input.ticketType?.trim()) return { ok: false, error: 'Enter which tickets are almost gone, e.g. "VIP"' }

    eventId = event.id
    eventName = event.name
    fields = {
      ...fields,
      eventName: event.name, slug: event.slug, venue: event.venue,
      date: formatDate(event.date, 'EEE d MMM'),
      price,
      deadline: input.deadline?.trim() ?? '',
      ticketType: input.ticketType?.trim() ?? '',
      referralPercent: input.template === 'share-link' ? await getReferralPercent() : 0,
    }
  }

  const recipients = await prisma.user.findMany({
    where: audienceWhere(input.template, eventId),
    select: { id: true, phone: true, referralCode: true },
  }).then(rows => rows.map(r => ({ userId: r.id, phone: r.phone, referralCode: r.referralCode })))

  const build = PROMO_TEMPLATES[input.template]
  const render = (r: Recipient) => build({ ...fields, referralCode: r.referralCode })
  const sample = render(recipients[0] ?? { userId: '', phone: '', referralCode: 'YOURCODE' })
  const creditsNeeded = recipients.reduce((n, r) => n + smsSegments(render(r)), 0)
  const [{ remaining }, alreadySent] = await Promise.all([
    smsCredits(),
    prisma.smsCampaign.count({ where: { template: input.template, eventId } }),
  ])

  return { ok: true, input, recipients, render, sample, creditsNeeded, creditsLeft: remaining, eventName, alreadySent }
}

const CONCURRENCY = 4
const PROGRESS_EVERY = 20

/** Records the campaign and sends it in the background; returns its id straight away. */
export async function startCampaign(p: PreparedCampaign, by: { id: string; name: string }): Promise<string> {
  const campaign = await prisma.smsCampaign.create({
    data: {
      template: p.input.template,
      eventId: p.input.eventId ?? null,
      params: { price: p.input.price ?? null, deadline: p.input.deadline ?? null, ticketType: p.input.ticketType ?? null },
      preview: p.sample,
      audience: p.recipients.length,
      createdById: by.id,
      createdByName: by.name,
    },
  })
  void runCampaign(campaign.id, p).catch(async err => {
    console.error(`[sms] campaign ${campaign.id} crashed`, err)
    await prisma.smsCampaign.update({
      where: { id: campaign.id },
      data: { status: 'stopped', stopReason: 'Stopped by an error — check the server log', finishedAt: new Date() },
    }).catch(() => {})
  })
  return campaign.id
}

async function runCampaign(id: string, p: PreparedCampaign): Promise<void> {
  const purpose = `campaign.${p.input.template}`
  let sent = 0
  let failed = 0
  let stopReason: string | null = null
  const queue = [...p.recipients]

  const saveProgress = () => prisma.smsCampaign.update({ where: { id }, data: { sent, failed } })

  while (queue.length > 0 && !stopReason) {
    const batch = queue.splice(0, CONCURRENCY)
    // Checked between batches, so an admin's "Stop" takes effect within a few messages
    const current = await prisma.smsCampaign.findUnique({ where: { id }, select: { status: true } })
    if (current?.status !== 'sending') { stopReason = 'Stopped by an admin'; break }

    const results = await Promise.all(batch.map(r => sendSms(r.phone, p.render(r), { kind: 'promotional', purpose, reference: id })))
    for (const result of results) {
      if (result === 'sent') sent++
      else failed++
      if (result === 'no_credit') stopReason = 'SMS credits ran out'
      if (result === 'off') stopReason = 'SMS was switched off'
    }
    if ((sent + failed) % PROGRESS_EVERY < CONCURRENCY) await saveProgress()
  }

  await prisma.smsCampaign.updateMany({
    where: { id, status: 'sending' },
    data: { sent, failed, status: stopReason ? 'stopped' : 'done', stopReason, finishedAt: new Date() },
  })
  // An admin stop already flipped the status; still record the final counts
  if (stopReason === 'Stopped by an admin') await prisma.smsCampaign.update({ where: { id }, data: { sent, failed, finishedAt: new Date() } })
}

export async function stopCampaign(id: string): Promise<boolean> {
  const { count } = await prisma.smsCampaign.updateMany({
    where: { id, status: 'sending' },
    data: { status: 'stopped', stopReason: 'Stopped by an admin' },
  })
  return count === 1
}

/** Campaigns cut off by a restart would say "sending" forever; call once on boot. */
export async function markInterruptedCampaigns(): Promise<void> {
  await prisma.smsCampaign.updateMany({
    where: { status: 'sending' },
    data: { status: 'stopped', stopReason: 'Interrupted by a server restart', finishedAt: new Date() },
  })
}
