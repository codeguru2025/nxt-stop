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

// Lazily create limiters only when Redis is available
let authLimiter: RateLimiterRedis | null = null
let scanLimiter: RateLimiterRedis | null = null
let orderLimiter: RateLimiterRedis | RateLimiterMemory | null = null

function getAuthLimiter(): RateLimiterRedis | null {
  if (!redis) return null
  if (!authLimiter) {
    authLimiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: 'rl:auth',
      points: 10,
      duration: 900,
      blockDuration: 900,
    })
  }
  return authLimiter
}

function getScanLimiter(): RateLimiterRedis | null {
  if (!redis) return null
  if (!scanLimiter) {
    scanLimiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: 'rl:scan',
      points: 120,
      duration: 60,
    })
  }
  return scanLimiter
}

// RateLimiterResolution objects have msBeforeNextReset; plain Errors mean Redis is down
function isRateLimited(e: any): boolean {
  return e != null && typeof e.msBeforeNextReset === 'number'
}

export async function checkAuthLimit(ip: string): Promise<{ limited: boolean; retryAfter?: number }> {
  const limiter = getAuthLimiter()
  if (!limiter) return { limited: false }
  return withTimeout(
    (async () => {
      try {
        await limiter.consume(ip)
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
  const limiter = getScanLimiter()
  if (!limiter) return { limited: false }
  return withTimeout(
    (async () => {
      try {
        await limiter.consume(ip)
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

