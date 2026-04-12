import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import EventDetailClient from '@/components/events/EventDetailClient'
import { getPublicEventDetailForPage } from '@/lib/data/publicPages'

export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ slug: string }> }

export default async function EventDetailPage({ params }: PageProps) {
  const { slug } = await params
  const initialEvent = await getPublicEventDetailForPage(slug)
  return (
    <>
      <Navbar />
      <main className="flex-1 pt-16">
        <EventDetailClient initialEvent={initialEvent} />
      </main>
      <Footer />
    </>
  )
}
