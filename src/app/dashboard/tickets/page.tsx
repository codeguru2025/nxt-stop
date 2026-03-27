import Navbar from '@/components/layout/Navbar'
import TicketsClient from '@/components/dashboard/TicketsClient'

export const metadata = { title: 'My Tickets' }

export default function TicketsPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 pt-20 min-h-screen">
        <TicketsClient />
      </main>
    </>
  )
}
