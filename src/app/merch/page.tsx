import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import MerchClient from '@/components/merch/MerchClient'
import { getMerchForPage } from '@/lib/data/publicPages'

export const metadata = {
  title: 'Merch | NXT STOP',
  description: 'Official NXT STOP merchandise — T-shirts, hoodies, caps and more.',
}

export default async function MerchPage() {
  const initialItems = await getMerchForPage()
  return (
    <>
      <Navbar />
      <main className="flex-1 pt-16">
        <MerchClient initialItems={initialItems} />
      </main>
      <Footer />
    </>
  )
}
