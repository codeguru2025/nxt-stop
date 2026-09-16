// Runs once when the Next.js server instance starts (see Next.js "instrumentation" file
// convention). This is the only place startDailyDigestScheduler() can safely import Prisma —
// server.ts is compiled separately by plain tsc and executed via raw `require()`, which
// cannot load the generated Prisma client (it relies on `import.meta.url`, ESM-only).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  // Next rethrows anything register() throws, which aborts the entire server boot
  // (see server.ts's app.prepare().catch(() => process.exit(1))) — a non-critical admin
  // email feature must never be able to take the whole app down, so failures here just
  // disable the digest instead of crashing startup.
  try {
    const { startDailyDigestScheduler } = await import('./lib/scheduler')
    startDailyDigestScheduler()
  } catch (err) {
    console.error('[digest] failed to initialize — daily digest disabled', err)
  }
}
