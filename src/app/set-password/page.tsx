import Navbar from '@/components/layout/Navbar'
import SetPasswordClient from '@/components/auth/SetPasswordClient'

export const metadata = { title: 'Set Password' }

export default function SetPasswordPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 pt-16 min-h-screen flex items-center justify-center px-4 py-12">
        <SetPasswordClient />
      </main>
    </>
  )
}
