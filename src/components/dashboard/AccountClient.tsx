'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check, AlertCircle, Eye, EyeOff } from 'lucide-react'

type Profile = {
  phone: string
  firstName: string | null
  lastName: string | null
  name: string
  email: string | null
  homeTown: string | null
  isWhatsApp: boolean
}

function Notice({ kind, text }: { kind: 'ok' | 'error'; text: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl p-3 text-sm border ${
      kind === 'ok' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
    }`}>
      {kind === 'ok' ? <Check size={14} /> : <AlertCircle size={14} />}
      {text}
    </div>
  )
}

export default function AccountClient() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [phone, setPhone] = useState('')
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', homeTown: '', isWhatsApp: true })
  const [saving, setSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [showPw, setShowPw] = useState(false)
  const [changingPw, setChangingPw] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/profile')
      .then(r => {
        if (r.status === 401) { router.push('/login?from=/dashboard/account'); return null }
        return r.json()
      })
      .then(d => {
        if (!d?.success) return
        const p = d.data as Profile
        setPhone(p.phone)
        setForm({
          firstName: p.firstName ?? p.name.split(' ')[0] ?? '',
          lastName: p.lastName ?? p.name.split(' ').slice(1).join(' '),
          email: p.email ?? '',
          homeTown: p.homeTown ?? '',
          isWhatsApp: p.isWhatsApp,
        })
      })
      .finally(() => setLoading(false))
  }, [router])

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setProfileMsg(null)
    try {
      const res = await fetch('/api/dashboard/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      }).then(r => r.json())
      setProfileMsg(res.success ? { kind: 'ok', text: 'Profile saved' } : { kind: 'error', text: res.error ?? 'Could not save' })
    } catch {
      setProfileMsg({ kind: 'error', text: 'Network error — check connection' })
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwMsg(null)
    if (pw.newPassword !== pw.confirm) { setPwMsg({ kind: 'error', text: 'New passwords don’t match' }); return }
    setChangingPw(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pw.currentPassword, newPassword: pw.newPassword }),
      }).then(r => r.json())
      if (res.success) {
        setPw({ currentPassword: '', newPassword: '', confirm: '' })
        setPwMsg({ kind: 'ok', text: 'Password changed' })
      } else {
        setPwMsg({ kind: 'error', text: res.error ?? 'Could not change password' })
      }
    } catch {
      setPwMsg({ kind: 'error', text: 'Network error — check connection' })
    } finally {
      setChangingPw(false)
    }
  }

  if (loading) return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <div className="skeleton h-8 w-48 rounded mb-6" />
      <div className="skeleton h-72 rounded-xl" />
    </div>
  )

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-black text-white mb-1">My Account</h1>
        <p className="text-gray-500 text-sm">Update your details and password</p>
      </div>

      <form onSubmit={saveProfile} className="card p-5 space-y-3">
        <h2 className="text-sm text-gray-400 font-semibold uppercase tracking-wider">Profile</h2>
        <div className="grid grid-cols-2 gap-3">
          <input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} placeholder="First name *" required className="w-full" />
          <input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} placeholder="Last name" className="w-full" />
        </div>
        <div>
          <input value={phone} disabled className="w-full opacity-60" aria-label="Phone number" />
          <p className="text-xs text-gray-600 mt-1">Your phone number is your login. Ask an admin if it needs to change.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input type="checkbox" checked={form.isWhatsApp} onChange={e => setForm({ ...form, isWhatsApp: e.target.checked })} />
          This number is on WhatsApp — send my tickets there
        </label>
        <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email — for receipts, tickets and password resets" className="w-full" />
        <input value={form.homeTown} onChange={e => setForm({ ...form, homeTown: e.target.value })} placeholder="Home town" className="w-full" />
        {profileMsg && <Notice {...profileMsg} />}
        <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
          {saving && <Loader2 size={16} className="animate-spin" />}
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </form>

      <form onSubmit={changePassword} className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm text-gray-400 font-semibold uppercase tracking-wider">Change password</h2>
          <button type="button" onClick={() => setShowPw(s => !s)} className="text-gray-500 hover:text-white" aria-label={showPw ? 'Hide passwords' : 'Show passwords'}>
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <input type={showPw ? 'text' : 'password'} value={pw.currentPassword} onChange={e => setPw({ ...pw, currentPassword: e.target.value })} placeholder="Current password" required autoComplete="current-password" className="w-full" />
        <input type={showPw ? 'text' : 'password'} value={pw.newPassword} onChange={e => setPw({ ...pw, newPassword: e.target.value })} placeholder="New password (min 8 characters)" required minLength={8} autoComplete="new-password" className="w-full" />
        <input type={showPw ? 'text' : 'password'} value={pw.confirm} onChange={e => setPw({ ...pw, confirm: e.target.value })} placeholder="Confirm new password" required minLength={8} autoComplete="new-password" className="w-full" />
        {pwMsg && <Notice {...pwMsg} />}
        <button type="submit" disabled={changingPw} className="btn-primary w-full flex items-center justify-center gap-2">
          {changingPw && <Loader2 size={16} className="animate-spin" />}
          {changingPw ? 'Changing…' : 'Change password'}
        </button>
      </form>
    </div>
  )
}
