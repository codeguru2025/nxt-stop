// One-off, idempotent backfill: split existing User.name into firstName/lastName
// for any row that doesn't have them yet. `name` itself is never touched — every
// app code path that reads user.name keeps working unchanged.
//
// Run with: npx tsx prisma/scripts/backfill-user-names.ts
import { createScriptClient } from './_client'

async function main() {
  const prisma = createScriptClient()
  const users = await prisma.user.findMany({
    where: { firstName: null },
    select: { id: true, name: true },
  })

  console.log(`Backfilling firstName/lastName for ${users.length} user(s)...`)

  let updated = 0
  for (const user of users) {
    const trimmed = (user.name ?? '').trim()
    const spaceIdx = trimmed.indexOf(' ')
    const firstName = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx)
    const lastName = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim()

    await prisma.user.update({
      where: { id: user.id },
      data: { firstName: firstName || 'Guest', lastName },
    })
    updated++
  }

  console.log(`Done. Updated ${updated} user(s).`)
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
