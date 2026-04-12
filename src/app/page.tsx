import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import HomeClient from '@/components/home/HomeClient'
import { getPublishedEventsForList, getPublicTeasers } from '@/lib/data/publicPages'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const [initialEvents, initialTeasers] = await Promise.all([
    getPublishedEventsForList(12),
    getPublicTeasers(),
  ])
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <HomeClient initialEvents={initialEvents} initialTeasers={initialTeasers} />
      </main>
      <Footer />
    </>
  )
}
