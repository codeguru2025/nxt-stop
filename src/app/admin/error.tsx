'use client'

import { useEffect } from 'react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Admin error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-white mb-2">Admin Error</h1>
        <p className="text-gray-400 mb-6">
          {error.message || 'An unexpected error occurred in the admin panel.'}
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
