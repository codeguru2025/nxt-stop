import { Suspense } from 'react'
import Navbar from '@/components/layout/Navbar'
import LoginClient from '@/components/auth/LoginClient'

export const metadata = { title: 'Sign In' }

export default function LoginPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 pt-16 min-h-screen flex items-center justify-center px-4">
        <Suspense fallback={<div className="w-full max-w-md"><div className="skeleton h-80 rounded-2xl" /></div>}>
          <LoginClient />
        </Suspense>
      </main>
    </>
  )
}
