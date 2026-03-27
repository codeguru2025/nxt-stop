import Redis from 'ioredis'

declare global {
  var __redis: Redis | undefined
}

function createRedisClient() {
  const url = process.env.REDIS_URL
  if (!url) throw new Error('REDIS_URL is not set')
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

// Singleton — shared across hot-reloads in dev
const redis = global.__redis ?? createRedisClient()
if (process.env.NODE_ENV !== 'production') global.__redis = redis

export { redis }
export default redis
