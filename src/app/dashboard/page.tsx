import Navbar from '@/components/layout/Navbar'
import DashboardClient from '@/components/dashboard/DashboardClient'

export const metadata = { title: 'My Dashboard' }

export default function DashboardPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 pt-20 min-h-screen">
        <DashboardClient />
      </main>
    </>
  )
}
