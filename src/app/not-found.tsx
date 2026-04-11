import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'

export default function NotFound() {
  return (
    <>
      <Navbar />
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4 pt-16">
        <div className="text-center max-w-md">
          <h1 className="text-7xl font-bold text-purple-500 mb-4">404</h1>
          <h2 className="text-2xl font-bold text-white mb-2">Page not found</h2>
          <p className="text-gray-400 mb-8">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </>
  )
}
