import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
// Uses the '@/*' alias on purpose — it only resolves under Next's own bundler (tsconfig.json),
// not under tsconfig.server.json (no 'paths' entry, and TS 'paths' don't rewrite emitted
// require() calls anyway). Do NOT import this file (or anything that imports it) from
// server.ts or any other file compiled by `tsc -p tsconfig.server.json` — it will fail to
// resolve at runtime. Server-side code that needs Prisma at boot belongs in
// src/instrumentation.ts instead, which Next bundles normally.
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
