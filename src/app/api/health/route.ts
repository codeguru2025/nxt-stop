import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { redis } from '@/lib/redis'

export async function GET() {
  const checks: Record<string, string> = {}

  // Database
  try {
    await prisma.$executeRaw`SELECT 1`
    checks.database = 'ok'
  } catch (e: any) {
    checks.database = `error: ${e.message?.slice(0, 100)}`
  }

  // Redis (optional)
  if (redis) {
    try {
      await redis.ping()
      checks.redis = 'ok'
    } catch (e: any) {
      checks.redis = `error: ${e.message?.slice(0, 100)}`
    }
  } else {
    checks.redis = 'not_configured'
  }

  const healthy = checks.database === 'ok'
  return NextResponse.json(
    { status: healthy ? 'ok' : 'degraded', timestamp: new Date().toISOString(), checks },
    { status: healthy ? 200 : 503 }
  )
}
