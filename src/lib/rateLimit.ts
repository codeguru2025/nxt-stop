import { RateLimiterRedis } from 'rate-limiter-flexible'
import { redis } from './redis'

// Lazily create limiters only when Redis is available
let authLimiter: RateLimiterRedis | null = null
let scanLimiter: RateLimiterRedis | null = null

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
  try {
    await limiter.consume(ip)
    return { limited: false }
  } catch (e: any) {
    if (isRateLimited(e)) return { limited: true, retryAfter: Math.ceil(e.msBeforeNextReset / 1000) }
    // Redis unavailable — fail open so auth still works
    return { limited: false }
  }
}

export async function checkScanLimit(ip: string): Promise<{ limited: boolean }> {
  const limiter = getScanLimiter()
  if (!limiter) return { limited: false }
  try {
    await limiter.consume(ip)
    return { limited: false }
  } catch (e: any) {
    if (isRateLimited(e)) return { limited: true }
    return { limited: false }
  }
}

/**
 * Acquire a short-lived distributed lock on a QR code to prevent double-scan
 * race conditions across multiple gate instances. Returns true if lock acquired.
 */
export async function acquireScanLock(qrCode: string): Promise<boolean> {
  if (!redis) return true // No Redis — allow scan
  try {
    const key = `lock:scan:${qrCode}`
    const result = await redis.set(key, '1', 'EX', 5, 'NX')
    return result === 'OK'
  } catch {
    // Redis unavailable — allow scan rather than block entry
    return true
  }
}

