import Navbar from '@/components/layout/Navbar'
import ReferralsClient from '@/components/dashboard/ReferralsClient'

export const metadata = { title: 'My Referrals' }

export default function ReferralsPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 pt-20 min-h-screen">
        <ReferralsClient />
      </main>
    </>
  )
}
