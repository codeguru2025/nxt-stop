'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Eye, EyeOff, Gift } from 'lucide-react'

export default function RegisterClient() {
  const router = useRouter()
  const params = useSearchParams()
  const ref = params.get('ref') ?? ''

  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', referralCode: ref })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).then(r => r.json())

    setLoading(false)

    if (res.success) {
      router.push('/dashboard')
      router.refresh()
    } else {
      setError(res.error ?? 'Registration failed')
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center mx-auto mb-4">
          <span className="text-white font-black text-2xl">N</span>
        </div>
        <h1 className="text-2xl font-black text-white">Create Account</h1>
        <p className="text-gray-500 text-sm mt-1">Join NXT STOP and start earning rewards</p>
      </div>

      <div className="card p-6">
        {ref && (
          <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 mb-5 text-sm text-purple-300">
            <Gift size={16} />
            You were referred — your friend will earn points when you buy!
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label>Full Name</label>
            <input placeholder="Your Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label>Email</label>
            <input type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div>
            <label>Phone (optional)</label>
            <input placeholder="+263 77..." value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <label>Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="Min 8 characters"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
                minLength={8}
                className="pr-10"
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {!ref && (
            <div>
              <label>Referral Code (optional)</label>
              <input placeholder="Enter referral code" value={form.referralCode} onChange={e => setForm(f => ({ ...f, referralCode: e.target.value }))} />
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">{error}</div>
          )}

          <button type="submit" disabled={loading} className="w-full btn-primary flex items-center justify-center gap-2">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Creating account...</> : 'Create Account'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <p className="text-gray-500 text-sm">
            Already have an account?{' '}
            <Link href="/login" className="text-purple-400 hover:text-purple-300 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
