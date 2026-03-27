import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import EventDetailClient from '@/components/events/EventDetailClient'

export default function EventDetailPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 pt-16">
        <EventDetailClient />
      </main>
      <Footer />
    </>
  )
}
