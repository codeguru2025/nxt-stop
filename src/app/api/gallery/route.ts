import { prisma } from '@/lib/db'
import { ok, serverError } from '@/lib/api'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50') || 50, 200)
    const cursor = url.searchParams.get('cursor')

    const photos = await prisma.galleryPhoto.findMany({
      where: { active: true },
      orderBy: { order: 'asc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = photos.length > limit
    if (hasMore) photos.pop()

    const res = ok({ photos, nextCursor: hasMore ? photos[photos.length - 1]?.id : null })
    res.headers.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300')
    return res
  } catch (e) {
    return serverError(e)
  }
}
