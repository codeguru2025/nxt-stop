import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'

declare global {
  var __prisma: PrismaClient | undefined
}

function create(): PrismaClient {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 15,
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
