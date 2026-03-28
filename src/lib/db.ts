import { Pool } from 'pg'
import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

declare global {
  var __prisma: PrismaClient | undefined
  var __pgPool: Pool | undefined
}

function createPrismaClient() {
  // Strip sslmode so pg-connection-string doesn't map it to verify-full,
  // which rejects DO's self-signed cert. We set ssl explicitly below.
  // The try/catch is a no-op guard for the build phase where DATABASE_URL
  // is absent and new URL() would throw.
  let connectionString = process.env.DATABASE_URL ?? ''
  try {
    const url = new URL(connectionString)
    url.searchParams.delete('sslmode')
    url.searchParams.delete('sslaccept')
    connectionString = url.toString()
  } catch {
    // no-op during next build
  }

  const pool = new Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 10_000,        // close idle connections after 10 s
    connectionTimeoutMillis: 30_000,  // allow 30 s to acquire a connection
    // TCP keepalive: send probes every 30 s so DO's VPC network / NAT
    // (which drops idle TCP after ~120 s) never sees the connection as idle.
    keepAlive: true,
    keepAliveInitialDelayMillis: 30_000,
    ssl: { rejectUnauthorized: false }, // accept DO's self-signed cert
  })

  pool.on('error', (err) => {
    console.error('[pg pool] idle client error:', err.message)
  })

  // Patch pool.query() with retry logic for transient "Connection terminated"
  // errors. PrismaPg calls pool.query() for every non-transactional operation,
  // so this single patch covers the entire read/write path.
  const originalQuery = pool.query.bind(pool)
  ;(pool as any).query = async function (...args: Parameters<typeof pool.query>) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await (originalQuery as any)(...args)
      } catch (err: any) {
        const isConnErr =
          attempt < 2 &&
          typeof err?.message === 'string' &&
          err.message.includes('Connection terminated')
        if (!isConnErr) throw err
        console.warn(`[pg pool] retrying after connection drop (attempt ${attempt + 1})`)
        await new Promise((r) => setTimeout(r, 150 * (attempt + 1)))
      }
    }
  }

  global.__pgPool = pool

  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter } as any)
}

// One PrismaClient + Pool per process — survives HMR in dev and module
// re-evaluations in prod.
const prisma = global.__prisma ?? createPrismaClient()
global.__prisma = prisma

export { prisma }
export default prisma
