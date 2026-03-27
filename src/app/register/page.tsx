import { Suspense } from 'react'
import Navbar from '@/components/layout/Navbar'
import RegisterClient from '@/components/auth/RegisterClient'

export const metadata = { title: 'Create Account' }

export default function RegisterPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 pt-16 min-h-screen flex items-center justify-center px-4 py-12">
        <Suspense fallback={<div className="w-full max-w-md"><div className="skeleton h-96 rounded-2xl" /></div>}>
          <RegisterClient />
        </Suspense>
      </main>
    </>
  )
}
