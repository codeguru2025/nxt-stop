import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import EventsClient from '@/components/events/EventsClient'

export const metadata = { title: 'Events' }

export default function EventsPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 pt-20">
        <EventsClient />
      </main>
      <Footer />
    </>
  )
}
