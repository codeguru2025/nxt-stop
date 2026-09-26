'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, CheckCircle } from 'lucide-react'

// Linked from every promotional SMS ("Opt out: nxt-stop.com/stop")
export default function SmsStopClient() {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/sms/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      }).then(r => r.json())
      if (res.success) setDone(res.data.message)
      else setError(res.error ?? 'Something went wrong')
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
          <h2 className="text-xl font-black text-white mb-2">You&apos;re opted out</h2>
          <p className="text-gray-400 text-sm mb-6">{done}</p>
          <Link href="/events" className="btn-primary inline-flex">Browse events</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-black text-white">Stop promotional SMS</h1>
        <p className="text-gray-500 text-sm mt-1">
          No more texts about new events and offers. Messages about your own tickets and payments still come.
        </p>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label>Phone number the texts come to</label>
            <input
              type="tel"
              placeholder="+263 77 123 4567"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              required
              autoComplete="tel"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading || !phone} className="w-full btn-primary flex items-center justify-center gap-2">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Please wait...</> : 'Stop promotional SMS'}
          </button>
        </form>
        <p className="text-gray-500 text-xs text-center mt-4">
          Changed your mind? Turn them back on in <Link href="/dashboard/account" className="text-purple-400 hover:text-purple-300">My Account</Link>.
        </p>
      </div>
    </div>
  )
}
