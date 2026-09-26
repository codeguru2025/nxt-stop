import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireCapability } from '@/lib/auth'
import { ok, error, forbidden, serverError } from '@/lib/api'
import { holdForApproval } from '@/lib/approvals'
import { describeSmsCampaign } from '@/lib/approvalDescribe'
import { writeAuditLog } from '@/lib/auditLog'
import { CAMPAIGNS, isPromoTemplate, prepareCampaign, startCampaign, stopCampaign } from '@/lib/smsCampaigns'
import { smsEnabled } from '@/lib/sms'

const CampaignSchema = z.object({
  template: z.string().refine(isPromoTemplate, 'Pick a message'),
  eventId: z.string().min(1).optional(),
  price: z.number().positive().max(100_000).optional(),
  deadline: z.string().trim().max(40).optional(),
  ticketType: z.string().trim().max(40).optional(),
})

// GET /api/admin/sms/campaigns — the message types, events to pick from, past campaigns
export async function GET() {
  try {
    const session = await requireCapability('events').catch(() => null)
    if (!session) return forbidden()
    const [events, campaigns] = await Promise.all([
      prisma.event.findMany({
        where: { status: { in: ['published', 'live', 'ended'] }, date: { gte: new Date(Date.now() - 60 * 24 * 3600e3) } },
        orderBy: { date: 'asc' },
        select: { id: true, name: true, date: true },
      }),
      prisma.smsCampaign.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
    ])
    return ok({ templates: CAMPAIGNS, events, campaigns, enabled: smsEnabled() })
  } catch (e) {
    return serverError(e)
  }
}

// POST /api/admin/sms/campaigns
//   { action: 'preview', template, eventId?, price?, deadline?, ticketType? } — who and what, nothing sent
//   { action: 'send', ...same }  — two-admin approval, then sends in the background
//   { action: 'stop', campaignId }
export async function POST(req: Request) {
  try {
    const session = await requireCapability('events').catch(() => null)
    if (!session) return forbidden()
    const body = await req.json().catch(() => ({}))

    if (body.action === 'stop') {
      const stopped = await stopCampaign(String(body.campaignId))
      return stopped ? ok({ message: 'Stopping — no more messages will go out' }) : error('That campaign is not sending')
    }
    if (body.action !== 'preview' && body.action !== 'send') return error('Unknown action')

    const parsed = CampaignSchema.safeParse(body)
    if (!parsed.success) return error(parsed.error.issues.map(i => i.message).join('; '))
    const input = { ...parsed.data, template: parsed.data.template as keyof typeof CAMPAIGNS }

    if (body.action === 'send') {
      if (!smsEnabled()) return error('SMS is switched off on this server')
      const held = await holdForApproval(req, session, {
        action: 'sms.campaign', capability: 'events', route: '/api/admin/sms/campaigns', body,
        entityType: 'SmsCampaign', describe: () => describeSmsCampaign(body),
      })
      if (held) return held
    }

    const p = await prepareCampaign(input)
    if (!p.ok) return error(p.error)
    const summary = {
      audience: p.recipients.length, sample: p.sample, creditsNeeded: p.creditsNeeded,
      creditsLeft: p.creditsLeft, alreadySent: p.alreadySent, eventName: p.eventName,
    }
    if (body.action === 'preview') return ok(summary)

    if (p.recipients.length === 0) return error('Nobody to send this to')
    if (p.creditsNeeded > p.creditsLeft) return error(`This needs ${p.creditsNeeded} credits but only ${p.creditsLeft} are left`)
    const campaignId = await startCampaign(p, { id: session.id, name: session.name })
    writeAuditLog({
      actorId: session.id, actorRole: session.role, req,
      action: 'sms.campaign.sent', entityType: 'SmsCampaign', entityId: campaignId,
      after: { template: input.template, eventName: p.eventName, audience: p.recipients.length, credits: p.creditsNeeded },
    })
    return ok({ campaignId, message: `Sending to ${p.recipients.length} people` })
  } catch (e) {
    return serverError(e)
  }
}
