import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible'
import { redis } from './redis'

// Hard timeout — if Redis is hung, bail after this many ms
const TIMEOUT_MS = 3_000

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), TIMEOUT_MS)),
  ])
}

// Lazily create limiters. Falls back to in-memory (per-instance) limiting when Redis is
// unavailable, so auth/scan throttling still applies in the sanctioned no-Redis deployment
// (see .do/app.yaml — REDIS_URL is optional) instead of silently disabling.
let authLimiter: RateLimiterRedis | RateLimiterMemory | null = null
let scanLimiter: RateLimiterRedis | RateLimiterMemory | null = null
let orderLimiter: RateLimiterRedis | RateLimiterMemory | null = null
let pollLimiter: RateLimiterRedis | RateLimiterMemory | null = null

function getAuthLimiter(): RateLimiterRedis | RateLimiterMemory {
  if (!authLimiter) {
    const opts = { keyPrefix: 'rl:auth', points: 10, duration: 900, blockDuration: 900 }
    authLimiter = redis
      ? new RateLimiterRedis({ storeClient: redis, ...opts })
      : new RateLimiterMemory(opts)
  }
  return authLimiter
}

function getScanLimiter(): RateLimiterRedis | RateLimiterMemory {
  if (!scanLimiter) {
    const opts = { keyPrefix: 'rl:scan', points: 120, duration: 60 }
    scanLimiter = redis
      ? new RateLimiterRedis({ storeClient: redis, ...opts })
      : new RateLimiterMemory(opts)
  }
  return scanLimiter
}

// RateLimiterResolution objects have msBeforeNextReset; plain Errors mean Redis is down
function isRateLimited(e: any): boolean {
  return e != null && typeof e.msBeforeNextReset === 'number'
}

export async function checkAuthLimit(ip: string): Promise<{ limited: boolean; retryAfter?: number }> {
  return withTimeout(
    (async () => {
      try {
        await getAuthLimiter().consume(ip)
        return { limited: false }
      } catch (e: any) {
        if (isRateLimited(e)) return { limited: true, retryAfter: Math.ceil(e.msBeforeNextReset / 1000) }
        return { limited: false }
      }
    })(),
    { limited: false } // Timeout fallback: fail open
  )
}

export async function checkScanLimit(ip: string): Promise<{ limited: boolean }> {
  return withTimeout(
    (async () => {
      try {
        await getScanLimiter().consume(ip)
        return { limited: false }
      } catch (e: any) {
        if (isRateLimited(e)) return { limited: true }
        return { limited: false }
      }
    })(),
    { limited: false }
  )
}

function getOrderLimiter(): RateLimiterRedis | RateLimiterMemory {
  if (!orderLimiter) {
    const opts = { keyPrefix: 'rl:order', points: 10, duration: 3600 } // 10 orders/hour per key
    orderLimiter = redis
      ? new RateLimiterRedis({ storeClient: redis, ...opts })
      : new RateLimiterMemory(opts)
  }
  return orderLimiter
}

function getPollLimiter(): RateLimiterRedis | RateLimiterMemory {
  if (!pollLimiter) {
    const opts = { keyPrefix: 'rl:poll', points: 30, duration: 60 } // 30 polls/min per key
    pollLimiter = redis
      ? new RateLimiterRedis({ storeClient: redis, ...opts })
      : new RateLimiterMemory(opts)
  }
  return pollLimiter
}

export async function checkPollLimit(key: string): Promise<{ limited: boolean }> {
  return withTimeout(
    (async () => {
      try {
        await getPollLimiter().consume(key)
        return { limited: false }
      } catch (e: any) {
        if (isRateLimited(e)) return { limited: true }
        return { limited: false }
      }
    })(),
    { limited: false }
  )
}

export async function checkOrderLimit(key: string): Promise<{ limited: boolean }> {
  return withTimeout(
    (async () => {
      try {
        await getOrderLimiter().consume(key)
        return { limited: false }
      } catch (e: any) {
        if (isRateLimited(e)) return { limited: true }
        return { limited: false }
      }
    })(),
    { limited: false }
  )
}

/**
 * Acquire a short-lived distributed lock on a QR code to prevent double-scan
 * race conditions across multiple gate instances. Returns true if lock acquired.
 */
export async function acquireScanLock(qrCode: string): Promise<boolean> {
  if (!redis) return true // No Redis — allow scan
  return withTimeout(
    (async () => {
      try {
        const key = `lock:scan:${qrCode}`
        const result = await redis.set(key, '1', 'EX', 5, 'NX')
        return result === 'OK'
      } catch {
        return true
      }
    })(),
    true // Timeout fallback: allow scan
  )
}

/** Drop scan lock immediately so the next validation isn’t blocked until key TTL. */
export async function releaseScanLock(qrCode: string): Promise<void> {
  if (!redis) return
  try {
    await Promise.race([
      redis.del(`lock:scan:${qrCode}`).then(() => undefined),
      new Promise<void>((_, rej) => setTimeout(() => rej(new Error('timeout')), 2000)),
    ])
  } catch {
    // Key may have expired; ignore
  }
}

