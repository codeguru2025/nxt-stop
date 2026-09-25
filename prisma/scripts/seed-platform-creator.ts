// One-off: make an account the platform creator, identified by email. The creator is above
// the platform owners: it gets the platform-owner flag and every admin capability, is the only
// account that can set SMS credits, and no other admin can edit, reset or revoke it.
// This is the ONLY place that ever sets the creator (Setting "platform.creatorUserId") —
// no API route accepts it. See src/lib/platformCreator.ts.
//
// Run with: npx tsx prisma/scripts/seed-platform-creator.ts <email> [--replace]
//   --replace  hand the creator role to a different account than the current one
import { createScriptClient } from './_client'
import { ADMIN_CAPABILITIES } from '../../src/lib/adminCapabilities'

const KEY = 'platform.creatorUserId' // same as PLATFORM_CREATOR_KEY in src/lib/platformCreator.ts

async function main() {
  const email = process.argv[2]
  const replace = process.argv.includes('--replace')
  if (!email || email.startsWith('--')) {
    console.error('Usage: npx tsx prisma/scripts/seed-platform-creator.ts <email> [--replace]')
    process.exit(1)
  }

  const prisma = createScriptClient()
  try {
    const user = await prisma.user.findFirst({ where: { email } })
    if (!user) throw new Error(`No user found with email ${email}`)

    const current = await prisma.setting.findUnique({ where: { key: KEY } })
    if (current?.value && current.value !== user.id && !replace) {
      const holder = await prisma.user.findUnique({ where: { id: current.value }, select: { email: true, name: true } })
      throw new Error(
        `The platform creator is already ${holder?.email ?? holder?.name ?? current.value}. ` +
        'Add --replace to hand the role to this account instead.',
      )
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { role: 'admin', isPlatformOwner: true, capabilities: [...ADMIN_CAPABILITIES] },
      }),
      prisma.setting.upsert({ where: { key: KEY }, create: { key: KEY, value: user.id }, update: { value: user.id } }),
      prisma.auditLog.create({
        data: {
          actorId: null, actorRole: 'script', action: 'platform.creator.set', entityType: 'User', entityId: user.id,
          before: { creatorUserId: current?.value ?? null }, after: { creatorUserId: user.id },
        },
      }),
    ])
    console.log(`${email} (user ${user.id}) is now the platform creator.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
