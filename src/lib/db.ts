import { Pool, PoolClient } from 'pg'
import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

declare global {
  var __prisma: PrismaClient | undefined
  var __pgPool: Pool | undefined
}

function createPrismaClient() {
  // Strip sslmode from the connection string — we configure SSL explicitly
  // on the Pool. pg-connection-string treats sslmode=require as verify-full
  // which logs a noisy warning and may cause cert-validation failures.
  // Guard against DATABASE_URL being absent at build time.
  let connectionString = process.env.DATABASE_URL!
  try {
    const url = new URL(connectionString)
    url.searchParams.delete('sslmode')
    url.searchParams.delete('sslaccept')
    connectionString = url.toString()
  } catch {
    // DATABASE_URL not set or invalid (e.g. during next build) — use as-is
  }

  const pool = new Pool({
    connectionString,
    max: 5,
    // Close connections after 10s idle — shorter than DO's load balancer
    // TCP idle timeout (~60-120s), so we never hand Prisma a stale connection.
    idleTimeoutMillis: 10_000,
    // Allow 30s to establish a new connection (cold-start / high load headroom).
    connectionTimeoutMillis: 30_000,
    // No TCP keepalive — idleTimeoutMillis handles recycling instead.
    keepAlive: false,
    ssl: { rejectUnauthorized: false },
  })

  pool.on('error', (err) => {
    console.error('[pg pool] Idle client error:', err.message)
  })

  // Validate connections before handing them to Prisma.
  // If a connection was killed server-side while idle, the lightweight
  // SELECT 1 will throw immediately so the pool destroys it and creates
  // a fresh one — preventing "Connection terminated unexpectedly" from
  // surfacing as a Prisma query error.
  const originalConnect = pool.connect.bind(pool)
  ;(pool as any).connect = async (): Promise<PoolClient> => {
    const client = await originalConnect()
    try {
      await client.query('SELECT 1')
      return client
    } catch {
      client.release(true) // destroy this dead connection
      // One retry — the pool will open a fresh TCP connection.
      return originalConnect()
    }
  }

  global.__pgPool = pool

  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter } as any)
}

// Singleton: cache the client on `globalThis` so it survives module
// re-evaluations in BOTH development (HMR) and production.
const prisma = global.__prisma ?? createPrismaClient()
global.__prisma = prisma

export { prisma }
export default prisma
