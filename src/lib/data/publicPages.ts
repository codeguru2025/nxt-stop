import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db'

/** Gallery — same as GET /api/gallery first page (URLs point at DO Spaces). */
export const getGalleryPhotosForPage = unstable_cache(
  async () => {
    const photos = await prisma.galleryPhoto.findMany({
      where: { active: true },
      orderBy: { order: 'asc' },
      take: 200,
    })
    return photos.map(p => ({
      id: p.id,
      url: p.url,
      caption: p.caption,
    }))
  },
  ['public-gallery-photos'],
  { revalidate: 120 }
)

/** Merch grid — same as GET /api/merch. */
export const getMerchForPage = unstable_cache(
  async () => {
    const products = await prisma.product.findMany({
      where: {
        category: 'merchandise',
        active: true,
      },
      orderBy: [{ merchType: 'asc' }, { price: 'asc' }],
      include: { event: { select: { id: true, name: true, date: true, slug: true } } },
    })
    return products
      .filter((p): p is (typeof p & { event: NonNullable<typeof p.event> }) => p.event != null)
      .map(p => ({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        stock: p.stock,
        sold: p.sold,
        merchType: p.merchType,
        size: p.size,
        color: p.color,
        description: p.description,
        image: p.image,
        event: {
          id: p.event.id,
          name: p.event.name,
          date: p.event.date.toISOString(),
          slug: p.event.slug,
        },
      }))
  },
  ['public-merch'],
  { revalidate: 120 }
)

const getPublishedEventsCached = unstable_cache(
  async (take: number) => {
    const events = await prisma.event.findMany({
      where: { status: { in: ['published', 'live'] } },
      orderBy: { date: 'asc' },
      take,
      include: {
        ticketTypes: {
          where: { active: true },
          orderBy: { price: 'asc' },
        },
        _count: { select: { tickets: true } },
      },
    })
    return events.map(e => ({
      id: e.id,
      name: e.name,
      slug: e.slug,
      date: e.date.toISOString(),
      endDate: e.endDate?.toISOString(),
      venue: e.venue,
      address: e.address ?? undefined,
      description: e.description ?? undefined,
      posterImage: e.posterImage ?? undefined,
      status: e.status,
      lineup: e.lineup ?? undefined,
      ticketTypes: e.ticketTypes.map(t => ({
        name: t.name,
        price: Number(t.price),
        capacity: t.capacity,
        sold: t.sold,
      })),
      _count: e._count,
    }))
  },
  ['published-events-list'],
  { revalidate: 60 }
)

/** Published events for home / events listing (poster URLs on DO Spaces). */
export function getPublishedEventsForList(limit: number) {
  const take = Math.min(Math.max(limit, 1), 100)
  return getPublishedEventsCached(take)
}

/** Past-event video teasers — same as GET /api/media/teasers. */
export const getPublicTeasers = unstable_cache(
  async () => {
    const teasers = await prisma.eventMedia.findMany({
      where: {
        type: 'teaser',
        event: { status: { in: ['published', 'live', 'ended'] } },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        event: { select: { name: true, date: true, slug: true } },
      },
    })
    return teasers.map(t => ({
      id: t.id,
      url: t.url,
      youtubeUrl: t.youtubeUrl,
      caption: t.caption,
      event: {
        name: t.event.name,
        date: t.event.date.toISOString(),
        slug: t.event.slug,
      },
    }))
  },
  ['public-teasers'],
  { revalidate: 120 }
)
