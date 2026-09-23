'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, ArrowLeft, CheckCircle, Mail } from 'lucide-react'

export default function ForgotPasswordClient() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      }).then(r => r.json())

      if (res.success) {
        setDone(true)
      } else {
        setError(res.error ?? 'Something went wrong — please try again')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="w-full max-w-md text-center">
        <div className="card p-8">
          <CheckCircle size={48} className="text-green-400 mx-auto mb-4" />
          <h2 className="text-xl font-black text-white mb-2">Check your email</h2>
          <p className="text-gray-400 text-sm mb-6">
            If an account exists for that email, a reset link has been sent — it expires in 30 minutes.
          </p>
          <Link href="/login" className="btn-primary inline-flex items-center gap-2">
            <ArrowLeft size={14} /> Back to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <img
          src="https://nxtstop-uploads.lon1.cdn.digitaloceanspaces.com/nxt-stop%20logo%20png.png"
          alt="NXT STOP"
          className="h-10 w-auto object-contain invert mx-auto mb-4"
        />
        <h1 className="text-2xl font-black text-white">Forgot Password</h1>
        <p className="text-gray-500 text-sm mt-1">
          Enter your email and we'll send you a reset link
        </p>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label>Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="pl-9"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            {loading
              ? <><Loader2 size={16} className="animate-spin" /> Sending...</>
              : 'Send Reset Link'}
          </button>
        </form>

        <div className="mt-4 text-center space-y-2">
          <p>
            <Link href="/forgot-password/legacy" className="text-gray-500 text-xs hover:text-purple-400 transition-colors">
              No email on your account? Request admin help
            </Link>
          </p>
          <Link href="/login" className="text-gray-500 text-sm hover:text-purple-400 transition-colors flex items-center justify-center gap-1">
            <ArrowLeft size={12} /> Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}
