'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Eye, EyeOff } from 'lucide-react'

export default function LoginClient() {
  const router = useRouter()
  const params = useSearchParams()

  /** Middleware sends `from`; older links may use `redirect`. Must be same-origin path only. */
  function safeReturnPath(raw: string | null): string | undefined {
    if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return undefined
    return raw
  }

  const explicitReturn =
    safeReturnPath(params.get('from')) ?? safeReturnPath(params.get('redirect'))

  const [form, setForm] = useState({ phone: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      }).then(r => r.json())

      if (res.success) {
        const role = res.data?.user?.role
        const dest = explicitReturn
          ?? (role === 'gate_staff' ? '/gate' : role === 'admin' ? '/admin' : '/dashboard')
        router.push(dest)
        router.refresh()
      } else {
        setError(res.error ?? 'Login failed')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <img
          src="https://nxtstop-uploads.lon1.cdn.digitaloceanspaces.com/nxt-stop%20logo%20new.png"
          alt="NXT STOP"
          className="h-10 w-auto object-contain invert mx-auto mb-4"
        />
        <h1 className="text-2xl font-black text-white">Welcome Back</h1>
        <p className="text-gray-500 text-sm mt-1">Sign in to your NXT STOP account</p>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label>Phone Number</label>
            <input
              type="tel"
              placeholder="+263 77 123 4567"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              required
              autoComplete="tel"
            />
          </div>

          <div>
            <label>Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in...</> : 'Sign In'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <p className="text-gray-500 text-sm">
            Don't have an account?{' '}
            <Link href="/register" className="text-purple-400 hover:text-purple-300 font-medium">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
