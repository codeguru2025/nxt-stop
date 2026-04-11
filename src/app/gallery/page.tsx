import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import GalleryClient from '@/components/gallery/GalleryClient'

export default function GalleryPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <GalleryClient />
      </main>
      <Footer />
    </>
  )
}
