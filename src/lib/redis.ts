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
    connectTimeout: 5_000, // Give up connecting after 5s
    maxRetriesPerRequest: 1, // Fail fast on individual commands
    retryStrategy: (times) => {
      if (times > 5) return null // Stop retrying after 5 attempts
      return Math.min(times * 200, 5_000)
    },
    enableReadyCheck: true,
    lazyConnect: true, // Don't block module load
    tls: url.startsWith('rediss://') ? {} : undefined,
  })
  client.on('error', (err) => console.error('[redis]', err.message))
  // Attempt connection but don't block
  client.connect().catch(() => {})
  return client
}

// Singleton — shared across hot-reloads in dev and in production
const redis = global.__redis !== undefined ? global.__redis : createRedisClient()
global.__redis = redis

export { redis }
export default redis
