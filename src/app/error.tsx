'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Unhandled error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">⚡</div>
        <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
        <p className="text-gray-400 mb-6">
          An unexpected error occurred. Please try again.
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
