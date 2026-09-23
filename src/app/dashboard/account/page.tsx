import Navbar from '@/components/layout/Navbar'
import AccountClient from '@/components/dashboard/AccountClient'

export const metadata = { title: 'My Account' }

export default function AccountPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 pt-16 min-h-screen">
        <AccountClient />
      </main>
    </>
  )
}
