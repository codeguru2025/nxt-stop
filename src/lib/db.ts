import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'

declare global {
  var __prisma: PrismaClient | undefined
}

function create(): PrismaClient {
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
    ssl: process.env.NODE_ENV === 'production'
      ? process.env.DO_CA_CERT
        ? { rejectUnauthorized: true, ca: Buffer.from(process.env.DO_CA_CERT, 'base64').toString() }
        : { rejectUnauthorized: false }
      : { rejectUnauthorized: false },
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
