import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import AboutClient from '@/components/about/AboutClient'

export const metadata = { title: 'About NXT STOP' }

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 pt-20">
        <AboutClient />
      </main>
      <Footer />
    </>
  )
}
