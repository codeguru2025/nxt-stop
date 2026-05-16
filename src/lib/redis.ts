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
    connectTimeout: 5_000,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => Math.min(times * 500, 30_000), // keep retrying, cap at 30s
    enableReadyCheck: true,
    lazyConnect: true,
    tls: url.startsWith('rediss://') ? {} : undefined,
  })
  client.on('error', (err) => console.error('[redis]', err.message))
  client.on('end', () => console.warn('[redis] connection closed'))
  // Attempt connection but don't block
  client.connect().catch(() => {})
  return client
}

// Singleton — shared across hot-reloads in dev and in production
const redis = global.__redis !== undefined ? global.__redis : createRedisClient()
global.__redis = redis

export { redis }
export default redis
