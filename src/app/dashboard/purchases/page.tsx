import Navbar from '@/components/layout/Navbar'
import PurchasesClient from '@/components/dashboard/PurchasesClient'

export const metadata = { title: 'My Purchases' }

export default function PurchasesPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 pt-16 min-h-screen">
        <PurchasesClient />
      </main>
    </>
  )
}
