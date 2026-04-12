import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import GalleryClient from '@/components/gallery/GalleryClient'
import { getGalleryPhotosForPage } from '@/lib/data/publicPages'

export const dynamic = 'force-dynamic'

export default async function GalleryPage() {
  const initialPhotos = await getGalleryPhotosForPage()
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <GalleryClient initialPhotos={initialPhotos} />
      </main>
      <Footer />
    </>
  )
}
