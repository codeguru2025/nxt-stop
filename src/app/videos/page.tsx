import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import PastVideosClient from '@/components/videos/PastVideosClient'
import { getPublicTeasers } from '@/lib/data/publicPages'

export const metadata = {
  title: 'Past Event Videos | NXT STOP',
  description: 'Relive past NXT STOP events — teaser clips and full sets on YouTube.',
}

export default async function VideosPage() {
  const initialTeasers = await getPublicTeasers()
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <PastVideosClient mode="page" initialTeasers={initialTeasers} />
      </main>
      <Footer />
    </>
  )
}
