import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import EventsClient from '@/components/events/EventsClient'
import { getPublishedEventsForList } from '@/lib/data/publicPages'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Events' }

type PageProps = { searchParams: Promise<{ ref?: string }> }

export default async function EventsPage({ searchParams }: PageProps) {
  const { ref: referralRef } = await searchParams
  const initialEvents = await getPublishedEventsForList(50)
  return (
    <>
      <Navbar />
      <main className="flex-1 pt-16">
        <EventsClient initialEvents={initialEvents} referralRef={referralRef ?? ''} />
      </main>
      <Footer />
    </>
  )
}
