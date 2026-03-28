import Redis from 'ioredis'

declare global {
  var __redis: Redis | null | undefined
}

function createRedisClient(): Redis | null {
  const url = process.env.REDIS_URL
  if (!url || url.includes('PASSWORD@') || url.includes('valkey-host')) {
    console.warn('[redis] REDIS_URL not configured — running without Redis')
    return null
  }
  const client = new Redis(url, {
    // Reconnect with exponential backoff up to 30s
    retryStrategy: (times) => Math.min(times * 200, 30_000),
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    tls: url.startsWith('rediss://') ? {} : undefined,
  })
  client.on('error', (err) => console.error('[redis]', err.message))
  return client
}

// Singleton — shared across hot-reloads in dev and in production
const redis = global.__redis !== undefined ? global.__redis : createRedisClient()
global.__redis = redis

export { redis }
export default redis
