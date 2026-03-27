import Navbar from '@/components/layout/Navbar'
import RewardsClient from '@/components/dashboard/RewardsClient'

export const metadata = { title: 'Rewards' }

export default function RewardsPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 pt-20 min-h-screen">
        <RewardsClient />
      </main>
    </>
  )
}
