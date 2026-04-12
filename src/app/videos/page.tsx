import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import PastVideosClient from '@/components/videos/PastVideosClient'

export const metadata = {
  title: 'Past Event Videos | NXT STOP',
  description: 'Relive past NXT STOP events — teaser clips and full sets on YouTube.',
}

export default function VideosPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <PastVideosClient mode="page" />
      </main>
      <Footer />
    </>
  )
}
