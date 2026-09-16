// Runs once when the Next.js server instance starts (see Next.js "instrumentation" file
// convention). This is the only place startDailyDigestScheduler() can safely import Prisma —
// server.ts is compiled separately by plain tsc and executed via raw `require()`, which
// cannot load the generated Prisma client (it relies on `import.meta.url`, ESM-only).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { startDailyDigestScheduler } = await import('./lib/scheduler')
  startDailyDigestScheduler()
}
