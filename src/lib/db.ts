import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'

declare global {
  var __prisma: PrismaClient | undefined
}

function create(): PrismaClient {
  const masked = (process.env.DATABASE_URL ?? '(unset)').replace(/:([^:@]+)@/, ':***@')
  console.log('[db] DATABASE_URL =', masked)
  // Strip sslmode from the connection string so pg-connection-string (v8.13+)
  // does not re-interpret it as sslmode=verify-full and override our ssl option.
  // SSL is controlled entirely by the ssl: {} option below.
  const rawUrl = process.env.DATABASE_URL ?? ''
  let connectionString = rawUrl
  try {
    const u = new URL(rawUrl)
    u.searchParams.delete('sslmode')
    connectionString = u.toString()
  } catch { /* non-URL strings are passed through unchanged */ }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 25,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 30_000,
  })

  pool.on('error', (err) => console.error('[db]', err.message))

  return new PrismaClient({ adapter: new PrismaPg(pool) } as any)
}

global.__prisma ??= create()
const prisma = global.__prisma

export default prisma
export { prisma }
