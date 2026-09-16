import { env } from './env'
import { buildDailyReport } from './reportData'
import { sendAdminDigestEmail } from './email'

const DAY_MS = 24 * 60 * 60 * 1000

function msUntilNextRun(hourUtc: number): number {
  const now = new Date()
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hourUtc, 0, 0, 0))
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
  return next.getTime() - now.getTime()
}

async function runDigest() {
  try {
    const report = await buildDailyReport(24)
    await sendAdminDigestEmail(report)
  } catch (err) {
    console.error('[digest] failed to send admin daily digest', err)
  }
}

// Fires once a day from inside the long-running server process — this app has no
// separate cron/worker infra, so a plain in-process timer is the simplest option
// given instance_count: 1 keeps a single process alive continuously.
export function startDailyDigestScheduler() {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    console.warn('[digest] RESEND_API_KEY or EMAIL_FROM not set — daily digest disabled')
    return
  }

  const hourUtc = parseInt(env.ADMIN_DIGEST_HOUR_UTC, 10)
  const delay = msUntilNextRun(isNaN(hourUtc) ? 6 : hourUtc)
  console.log(`[digest] next admin daily digest in ${Math.round(delay / 60000)} min`)

  setTimeout(() => {
    runDigest()
    setInterval(runDigest, DAY_MS)
  }, delay)
}
