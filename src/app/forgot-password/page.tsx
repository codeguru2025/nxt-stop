import Navbar from '@/components/layout/Navbar'
import ForgotPasswordClient from '@/components/auth/ForgotPasswordClient'

export const metadata = { title: 'Forgot Password' }

export default function ForgotPasswordPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 pt-16 min-h-screen flex items-center justify-center px-4">
        <ForgotPasswordClient />
      </main>
    </>
  )
}
