// One-off: grant the irrevocable platform-owner flag to an account, identified
// by email (currently the platform owner and the platform creator — both may read the
// audit log and receive its daily PDF). This is the ONLY place in the entire codebase that ever sets
// User.isPlatformOwner — no API route accepts this field from a request body.
//
// Run with: npx tsx prisma/scripts/seed-platform-owner.ts <email>
import { createScriptClient } from './_client'

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error('Usage: npx tsx prisma/scripts/seed-platform-owner.ts <email>')
    process.exit(1)
  }

  const prisma = createScriptClient()
  const user = await prisma.user.findFirst({ where: { email } })
  if (!user) {
    console.error(`No user found with email ${email}`)
    await prisma.$disconnect()
    process.exit(1)
  }

  if (user.isPlatformOwner) {
    console.log(`${email} is already the platform owner.`)
    await prisma.$disconnect()
    return
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { isPlatformOwner: true, role: 'admin' },
  })

  console.log(`${email} (user ${user.id}) is now the platform owner.`)
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
