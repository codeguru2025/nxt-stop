// Standalone Prisma client for one-off maintenance scripts run via `npx tsx`.
// Deliberately does NOT import src/lib/db.ts — that file uses the `@/*` alias,
// which only resolves under Next's bundler, not under a plain tsx invocation.
import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../src/generated/prisma/client'

export function createScriptClient(): PrismaClient {
  const rawUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? ''
  if (!rawUrl) throw new Error('DATABASE_URL (or DIRECT_URL) is not set')

  let connectionString = rawUrl
  try {
    const u = new URL(rawUrl)
    u.searchParams.delete('sslmode')
    connectionString = u.toString()
  } catch { /* non-URL strings pass through unchanged */ }

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } })
  return new PrismaClient({ adapter: new PrismaPg(pool) } as any)
}
