import Navbar from '@/components/layout/Navbar'
import SmsStopClient from '@/components/auth/SmsStopClient'

export const metadata = { title: 'Stop promotional SMS' }

export default function SmsStopPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 pt-16 min-h-screen flex items-center justify-center px-4">
        <SmsStopClient />
      </main>
    </>
  )
}
