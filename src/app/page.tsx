import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import HomeClient from '@/components/home/HomeClient'

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <HomeClient />
      </main>
      <Footer />
    </>
  )
}
