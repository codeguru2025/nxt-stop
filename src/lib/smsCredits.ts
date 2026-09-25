import { prisma } from './db'
import { notifyAdmins } from './push'

/** Admins get a push alert when credits drop to this, and again when they run out. */
export const SMS_LOW_CREDITS = 100

export type SmsCredits = { bought: number; used: number; remaining: number }

/**
 * Credits bought (top-ups recorded by a platform owner) minus credits used by sent SMS.
 * Throws if the SMS tables don't exist yet (20260925150000_sms_credits not run).
 */
export async function smsCredits(): Promise<SmsCredits> {
  const [bought, used] = await Promise.all([
    prisma.smsTopUp.aggregate({ _sum: { credits: true } }),
    prisma.smsMessage.aggregate({ where: { status: 'sent' }, _sum: { segments: true } }),
  ])
  const b = bought._sum.credits ?? 0
  const u = used._sum.segments ?? 0
  return { bought: b, used: u, remaining: b - u }
}

type Level = 'ok' | 'low' | 'empty'
const ALERT_KEY = 'sms.creditAlert'

/**
 * Push-alerts every admin once when credits fall to SMS_LOW_CREDITS and once when they
 * run out; a top-up resets it. The last level alerted is kept in Setting so a busy sales
 * day doesn't send one alert per order. Never throws.
 */
export async function checkSmsCreditAlert(remaining: number): Promise<void> {
  try {
    const level: Level = remaining <= 0 ? 'empty' : remaining <= SMS_LOW_CREDITS ? 'low' : 'ok'
    const prev = (await prisma.setting.findUnique({ where: { key: ALERT_KEY } }))?.value ?? 'ok'
    if (level === prev) return
    await prisma.setting.upsert({ where: { key: ALERT_KEY }, create: { key: ALERT_KEY, value: level }, update: { value: level } })
    if (level === 'ok') return
    await notifyAdmins({
      title: level === 'empty' ? 'SMS credits used up' : 'SMS credits running low',
      body: level === 'empty'
        ? 'Customers are getting email and WhatsApp only until more SMS credits are added.'
        : `${remaining} SMS credits left. Buy more before they run out.`,
      url: '/admin/sms',
      tag: 'sms-credits',
    })
  } catch (err) {
    console.error('[sms] credit alert failed', err)
  }
}

/** "+263771234567" → "+26377***567": enough to recognise, not enough to misuse. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7) return '***'
  return `+${digits.slice(0, 5)}***${digits.slice(-3)}`
}
