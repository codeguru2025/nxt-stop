import { RateLimiterRedis } from 'rate-limiter-flexible'
import { redis } from './redis'

// Auth endpoints: 10 attempts per 15 minutes per IP
const authLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl:auth',
  points: 10,
  duration: 900,
  blockDuration: 900,
})

// Scan endpoint: 120 scans per minute per IP (2/sec — fast gate throughput)
const scanLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl:scan',
  points: 120,
  duration: 60,
})

export async function checkAuthLimit(ip: string): Promise<{ limited: boolean; retryAfter?: number }> {
  try {
    await authLimiter.consume(ip)
    return { limited: false }
  } catch (res: any) {
    return { limited: true, retryAfter: Math.ceil(res.msBeforeNextReset / 1000) }
  }
}

export async function checkScanLimit(ip: string): Promise<{ limited: boolean }> {
  try {
    await scanLimiter.consume(ip)
    return { limited: false }
  } catch {
    return { limited: true }
  }
}

/**
 * Acquire a short-lived distributed lock on a QR code to prevent double-scan
 * race conditions across multiple gate instances. Returns true if lock acquired.
 */
export async function acquireScanLock(qrCode: string): Promise<boolean> {
  const key = `lock:scan:${qrCode}`
  const result = await redis.set(key, '1', 'EX', 5, 'NX')
  return result === 'OK'
}
