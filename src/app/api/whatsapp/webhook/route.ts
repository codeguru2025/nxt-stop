import crypto from 'crypto'
import { env } from '@/lib/env'

function verifySignature(rawBody: string, signatureHeader: string, appSecret: string): boolean {
  const parts = signatureHeader.split('=')
  if (parts.length !== 2 || parts[0] !== 'sha256') return false
  const expected = parts[1]
  const digest = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')
  const a = Buffer.from(digest, 'hex')
  const b = Buffer.from(expected, 'hex')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  if (!verifyToken) {
    return new Response('Missing WHATSAPP_WEBHOOK_VERIFY_TOKEN', { status: 500 })
  }

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return new Response(challenge, { status: 200 })
  }

  return new Response('Forbidden', { status: 403 })
}

type WhatsAppWebhookPayload = {
  object?: string
  entry?: Array<{
    id?: string
    changes?: Array<{
      field?: string
      value?: {
        metadata?: { display_phone_number?: string; phone_number_id?: string }
        contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>
        messages?: Array<{ id?: string; from?: string; type?: string; timestamp?: string }>
        statuses?: Array<{ id?: string; status?: string; timestamp?: string; recipient_id?: string }>
      }
    }>
  }>
}

export async function POST(req: Request) {
  const raw = await req.text()
  const appSecret = env.META_APP_SECRET
  const signature = req.headers.get('x-hub-signature-256')

  if (appSecret) {
    if (!signature || !verifySignature(raw, signature, appSecret)) {
      return new Response('Invalid signature', { status: 401 })
    }
  }

  let payload: WhatsAppWebhookPayload
  try {
    payload = JSON.parse(raw) as WhatsAppWebhookPayload
  } catch {
    return new Response('Bad JSON', { status: 400 })
  }

  if (payload.object !== 'whatsapp_business_account') {
    return new Response('Ignored', { status: 200 })
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value
      for (const status of value?.statuses ?? []) {
        console.log('[whatsapp:webhook:status]', {
          wabaId: entry.id,
          phoneNumberId: value?.metadata?.phone_number_id,
          messageId: status.id,
          recipientId: status.recipient_id,
          status: status.status,
          timestamp: status.timestamp,
        })
      }

      for (const message of value?.messages ?? []) {
        console.log('[whatsapp:webhook:message]', {
          wabaId: entry.id,
          phoneNumberId: value?.metadata?.phone_number_id,
          from: message.from,
          messageId: message.id,
          type: message.type,
          timestamp: message.timestamp,
        })
      }
    }
  }

  return new Response('OK', { status: 200 })
}
