import { prisma } from '@/lib/db'
import { fulfillOrder } from '@/lib/fulfillOrder'
import { parseEcocashSms, phonesLooselyMatch } from '@/lib/ecocash'
import { env } from '@/lib/env'
import crypto from 'crypto'

const MATCH_WINDOW_MS = 60 * 60 * 1000 // orders older than this are no longer candidates

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a.padEnd(64))
  const bufB = Buffer.from(b.padEnd(64))
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB) && a === b
}

// POST /api/ecocash/sms-webhook
// Called by an SMS-forwarding app running on the phone that holds the EcoCash SIM
// (ECOCASH_MERCHANT_NUMBER). Every inbound SMS on that phone gets POSTed here.
// Auth: shared secret in the `x-ecocash-secret` header (this is not a browser request,
// so it carries no session cookie or CSRF token — see CSRF_EXEMPT in middleware.ts).
export async function POST(req: Request) {
  try {
    const provided = req.headers.get('x-ecocash-secret') ?? ''
    if (!timingSafeEqual(provided, env.ECOCASH_WEBHOOK_SECRET)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const rawText: string = body.message ?? body.text ?? body.body ?? body.sms ?? ''
    const fromNumber: string | undefined = body.from ?? body.sender ?? body.number ?? undefined

    if (!rawText.trim()) {
      return Response.json({ error: 'No message text provided' }, { status: 400 })
    }

    const parsed = parseEcocashSms(rawText)

    if (!parsed) {
      await prisma.ecocashSmsLog.create({
        data: { rawText, fromNumber, matchStatus: 'unmatched' },
      })
      return Response.json({ ok: true, matched: false, reason: 'Could not parse amount from message' })
    }

    const since = new Date(Date.now() - MATCH_WINDOW_MS)
    const candidates = await prisma.order.findMany({
      where: {
        paymentMethod: 'ecocash',
        status: 'pending',
        total: parsed.amount,
        createdAt: { gte: since },
      },
      select: { id: true, ecocashPayerPhone: true },
    })

    let matches = candidates
    if (parsed.payerPhone) {
      const phoneFiltered = candidates.filter((c) => phonesLooselyMatch(c.ecocashPayerPhone, parsed.payerPhone))
      if (phoneFiltered.length > 0) matches = phoneFiltered
    }

    if (matches.length === 1) {
      const orderId = matches[0].id
      try {
        await fulfillOrder(orderId, 'ecocash', parsed.txRef)
      } catch (fulfillErr) {
        console.error(`EcoCash SMS webhook: fulfillOrder failed for order ${orderId}`, fulfillErr)
        await prisma.ecocashSmsLog.create({
          data: {
            rawText, fromNumber,
            parsedAmount: parsed.amount, parsedPayer: parsed.payerPhone, parsedTxRef: parsed.txRef,
            matchedOrderId: orderId, matchStatus: 'unmatched',
          },
        })
        return Response.json({ ok: false, matched: false, reason: 'Fulfillment failed — logged for review' }, { status: 500 })
      }

      await prisma.ecocashSmsLog.create({
        data: {
          rawText, fromNumber,
          parsedAmount: parsed.amount, parsedPayer: parsed.payerPhone, parsedTxRef: parsed.txRef,
          matchedOrderId: orderId, matchStatus: 'matched',
        },
      })
      return Response.json({ ok: true, matched: true, orderId })
    }

    // Zero or multiple candidates — don't guess. An admin can manually fulfill the
    // right order from the existing admin orders panel once they see this log entry.
    await prisma.ecocashSmsLog.create({
      data: {
        rawText, fromNumber,
        parsedAmount: parsed.amount, parsedPayer: parsed.payerPhone, parsedTxRef: parsed.txRef,
        matchStatus: matches.length === 0 ? 'unmatched' : 'ambiguous',
      },
    })
    return Response.json({ ok: true, matched: false, candidateCount: matches.length })
  } catch (e) {
    console.error('EcoCash SMS webhook error', e)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
