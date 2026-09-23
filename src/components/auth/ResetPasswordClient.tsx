'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Eye, EyeOff, ArrowLeft, CheckCircle } from 'lucide-react'

export default function ResetPasswordClient() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      }).then(r => r.json())

      if (res.success) {
        setDone(true)
        setTimeout(() => router.push('/login'), 2000)
      } else {
        setError(res.error ?? 'Something went wrong — please try again')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="w-full max-w-md text-center">
        <div className="card p-8">
          <h2 className="text-xl font-black text-white mb-2">Invalid link</h2>
          <p className="text-gray-400 text-sm mb-6">This reset link is missing its token.</p>
          <Link href="/forgot-password" className="btn-primary inline-flex items-center gap-2">
            <ArrowLeft size={14} /> Request a new link
          </Link>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="w-full max-w-md text-center">
        <div className="card p-8">
          <CheckCircle size={48} className="text-green-400 mx-auto mb-4" />
          <h2 className="text-xl font-black text-white mb-2">Password reset</h2>
          <p className="text-gray-400 text-sm">Redirecting you to sign in...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-black text-white">Set a new password</h1>
        <p className="text-gray-500 text-sm mt-1">Choose a password you'll remember</p>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label>New Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="Min 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                className="pr-10"
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">{error}</div>
          )}

          <button type="submit" disabled={loading} className="w-full btn-primary flex items-center justify-center gap-2">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Resetting...</> : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
