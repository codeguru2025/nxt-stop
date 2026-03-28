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
  // which logs a noisy warning. Guard against DATABASE_URL being absent at
  // build time (next build runs without runtime env vars).
  let connectionString = process.env.DATABASE_URL!
  try {
    const url = new URL(connectionString)
    url.searchParams.delete('sslmode')
    url.searchParams.delete('sslaccept')
    connectionString = url.toString()
  } catch {
    // DATABASE_URL not set or invalid at build time — use as-is
  }

  const pool = new Pool({
    connectionString,
    max: 5,
    // Close idle connections after 10s — well within DO VPC's TCP idle timeout,
    // ensuring the pool never hands Prisma a stale connection.
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 30_000,
    keepAlive: false,
    ssl: { rejectUnauthorized: false },
  })

  pool.on('error', (err) => {
    console.error('[pg pool] Idle client error:', err.message)
  })

  // Validate connections on checkout. If a connection was killed server-side
  // while idle, SELECT 1 detects it immediately so the pool destroys and
  // replaces it — preventing "Connection terminated unexpectedly" errors.
  const originalConnect = pool.connect.bind(pool)
  ;(pool as any).connect = async (): Promise<PoolClient> => {
    const client = await originalConnect()
    try {
      await client.query('SELECT 1')
      return client
    } catch {
      client.release(true) // destroy the dead connection
      return originalConnect() // one retry with a fresh connection
    }
  }

  global.__pgPool = pool

  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter } as any)
}

// Singleton: one PrismaClient/Pool per process in both dev (HMR) and production.
const prisma = global.__prisma ?? createPrismaClient()
global.__prisma = prisma

export { prisma }
export default prisma
