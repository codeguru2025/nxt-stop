import Navbar from '@/components/layout/Navbar'
import LegacyPhoneResetClient from '@/components/auth/LegacyPhoneResetClient'

export const metadata = { title: 'Request Admin Help' }

export default function LegacyForgotPasswordPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 pt-16 min-h-screen flex items-center justify-center px-4">
        <LegacyPhoneResetClient />
      </main>
    </>
  )
}
