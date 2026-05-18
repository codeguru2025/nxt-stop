'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, ArrowLeft, CheckCircle } from 'lucide-react'

export default function ForgotPasswordClient() {
  const [phone, setPhone] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const csrfToken = document.cookie
        .split('; ')
        .find(r => r.startsWith('csrf-token='))
        ?.split('=')[1]

      const res = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
        },
        body: JSON.stringify({ phone: phone.trim(), reason: reason.trim() || undefined }),
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
          <h2 className="text-xl font-black text-white mb-2">Request Sent!</h2>
          <p className="text-gray-400 text-sm mb-6">
            Your request has been logged. An admin will verify your identity and
            contact you with a new password — usually within a few hours.
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
          src="https://nxtstop-uploads.lon1.cdn.digitaloceanspaces.com/nxt-stop%20logo%20new.png"
          alt="NXT STOP"
          className="h-10 w-auto object-contain invert mx-auto mb-4"
        />
        <h1 className="text-2xl font-black text-white">Forgot Password</h1>
        <p className="text-gray-500 text-sm mt-1">
          Submit a request — an admin will reset it for you
        </p>
      </div>

      <div className="card p-6">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-5 text-sm text-blue-300">
          Since we don't collect email addresses, an admin manually verifies requests
          and sends you a new password. Make sure your phone number matches your account.
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label>Phone Number on your account</label>
            <input
              type="tel"
              placeholder="+263 77 123 4567"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              required
              autoComplete="tel"
            />
          </div>

          <div>
            <label>
              Reason / note for admin{' '}
              <span className="text-gray-600 text-xs font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              placeholder="e.g. I recently changed phones and lost access"
              value={reason}
              onChange={e => setReason(e.target.value)}
              maxLength={280}
              className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !phone}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            {loading
              ? <><Loader2 size={16} className="animate-spin" /> Sending...</>
              : 'Send Reset Request'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link href="/login" className="text-gray-500 text-sm hover:text-purple-400 transition-colors flex items-center justify-center gap-1">
            <ArrowLeft size={12} /> Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}
