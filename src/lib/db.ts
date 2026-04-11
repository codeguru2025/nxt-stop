import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'

declare global {
  var __prisma: PrismaClient | undefined
}

function create(): PrismaClient {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // In production: verify the cert if DO_CA_CERT is supplied (base64-encoded PEM),
    // otherwise fall back to skip verification (safe for DO-internal traffic).
    // To harden: download the CA cert from DO dashboard → database → Connection Details,
    // then set DO_CA_CERT=$(base64 -w0 ca-certificate.crt) in App Platform env vars.
    ssl: process.env.NODE_ENV === 'production'
      ? process.env.DO_CA_CERT
        ? { rejectUnauthorized: true, ca: Buffer.from(process.env.DO_CA_CERT, 'base64').toString('utf8') }
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
