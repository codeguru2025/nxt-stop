import { Suspense } from 'react'
import Navbar from '@/components/layout/Navbar'
import ResetPasswordClient from '@/components/auth/ResetPasswordClient'

export const metadata = { title: 'Reset Password' }

export default function ResetPasswordPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 pt-16 min-h-screen flex items-center justify-center px-4 py-12">
        <Suspense fallback={<div className="w-full max-w-md"><div className="skeleton h-96 rounded-2xl" /></div>}>
          <ResetPasswordClient />
        </Suspense>
      </main>
    </>
  )
}
