import { redirect } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import RewardsClient from '@/components/dashboard/RewardsClient'
import { FEATURES } from '@/lib/features'

export const metadata = { title: 'Rewards' }

export default function RewardsPage() {
  if (!FEATURES.points) redirect('/dashboard')
  return (
    <>
      <Navbar />
      <main className="flex-1 pt-16 min-h-screen">
        <RewardsClient />
      </main>
    </>
  )
}
