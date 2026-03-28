import { Pool } from 'pg'
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
    // Keep the pool small — DigitalOcean managed PG has a limited connection
    // budget (typ. 25 for basic plans). With keepAlive + idle timeout the
    // pool will hold onto connections efficiently.
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    ssl: { rejectUnauthorized: false },
  })

  // Prevent unhandled 'error' events from crashing the process.
  // Broken-idle connections are removed automatically by the pool.
  pool.on('error', (err) => {
    console.error('[pg pool] Idle client error:', err.message)
  })

  global.__pgPool = pool

  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter } as any)
}

// Singleton: cache the client on `globalThis` so it survives module
// re-evaluations in BOTH development (HMR) and production (edge cases
// where bundlers re-run the module init).
const prisma = global.__prisma ?? createPrismaClient()
global.__prisma = prisma

export { prisma }
export default prisma
