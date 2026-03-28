import { Pool } from 'pg'
import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

declare global {
  var __prisma: PrismaClient | undefined
  var __pgPool: Pool | undefined
}

function createPrismaClient() {
  // Parse DATABASE_URL so we can set SSL explicitly on the Pool config.
  // pg-connection-string maps sslmode=require → verify-full, which rejects
  // DO's self-signed cert. Stripping it lets our ssl option below take over.
  // The try/catch handles the build phase where DATABASE_URL is not set.
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
    idleTimeoutMillis: 10_000,        // recycle before DO's LB idle timeout
    connectionTimeoutMillis: 30_000,  // allow 30 s to establish a connection
    ssl: { rejectUnauthorized: false }, // accept DO's self-signed cert
  })

  pool.on('error', (err) => {
    // prevents unhandled-rejection crashes when the server drops an idle client
    console.error('[pg pool] client error:', err.message)
  })

  global.__pgPool = pool

  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter } as any)
}

// One PrismaClient per process — survives HMR in dev and module re-evals in prod
const prisma = global.__prisma ?? createPrismaClient()
global.__prisma = prisma

export { prisma }
export default prisma
