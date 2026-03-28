import { prisma } from '@/lib/db'
import { ok, serverError } from '@/lib/api'

export async function GET() {
  try {
    const photos = await prisma.galleryPhoto.findMany({
      where: { active: true },
      orderBy: { order: 'asc' },
    })
    return ok(photos)
  } catch (e) {
    return serverError(e)
  }
}
